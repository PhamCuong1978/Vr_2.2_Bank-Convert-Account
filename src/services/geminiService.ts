import { GoogleGenAI } from "@google/genai";
import type { GeminiResponse, AIChatResponse, ChatMessage, Transaction } from '../types';

// --- CONFIGURATION ---
// 1. Gemini Key (Dùng cho OCR hình ảnh)
const getGeminiAI = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey || apiKey.includes("undefined")) {
        console.error("Gemini API Key bị thiếu.");
        throw new Error("Thiếu Google API Key (dùng cho đọc ảnh). Vui lòng thêm 'VITE_API_KEY' vào biến môi trường.");
    }
    return new GoogleGenAI({ apiKey: apiKey });
};

// 2. DeepSeek Key (Dùng cho Logic Kế toán & Chat)
const getDeepSeekKey = () => {
    const key = process.env.DEEPSEEK_API_KEY;
    if (!key || key.includes("undefined")) {
        // Fallback: Nếu không có DeepSeek Key, thử dùng Gemini Key (nếu người dùng chưa kịp tạo DeepSeek Key)
        // Lưu ý: Đây chỉ là logic tạm thời, tốt nhất nên bắt buộc có key riêng.
        console.warn("Chưa có DEEPSEEK_API_KEY. Vui lòng thêm biến môi trường 'VITE_DEEPSEEK_API_KEY' để sử dụng DeepSeek.");
        return null;
    }
    return key;
};

// --- HELPER: Call DeepSeek API ---
const callDeepSeek = async (messages: any[], jsonMode: boolean = true) => {
    const apiKey = getDeepSeekKey();
    
    if (!apiKey) {
        throw new Error("Yêu cầu DEEPSEEK_API_KEY để sử dụng tính năng phân tích nâng cao.");
    }

    try {
        const response = await fetch("https://api.deepseek.com/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "deepseek-chat", // DeepSeek V3
                messages: messages,
                temperature: 0.1, // Low temp for logic
                response_format: jsonMode ? { type: "json_object" } : { type: "text" },
                stream: false
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(`DeepSeek API Error: ${errData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error("DeepSeek API Call Failed:", error);
        throw error;
    }
};

/**
 * Step 1: Extracts raw text from images using GEMINI FLASH (Best for OCR/Vision).
 * DeepSeek hiện tại chưa hỗ trợ upload ảnh trực tiếp tốt bằng Gemini cho tác vụ này.
 */
export const extractTextFromContent = async (content: { images: { mimeType: string; data: string }[] }): Promise<string> => {
    if (content.images.length === 0) return '';
    
    const prompt = `Bạn là công cụ OCR tài chính. Nhiệm vụ: Trích xuất toàn bộ văn bản từ sao kê ngân hàng.
    QUY TẮC:
    1. Giữ nguyên định dạng số (dấu chấm/phẩy).
    2. Tuyệt đối không bỏ sót số 0 (Ví dụ: 3,000,000 là ba triệu, không phải ba trăm).
    3. Chỉ trả về văn bản thô, không thêm lời dẫn.`;

    try {
        const ai = getGeminiAI();
        const imageParts = content.images.map(img => ({
            inlineData: {
                mimeType: img.mimeType,
                data: img.data,
            }
        }));

        const modelRequest = {
            model: "gemini-2.5-flash", // Flash cực nhanh và rẻ cho OCR
            contents: { parts: [{ text: prompt }, ...imageParts] },
            config: { temperature: 0 }
        };

        const response = await ai.models.generateContent(modelRequest);
        return (response.text || '').trim();
    } catch (error) {
        console.error("OCR Failed:", error);
        throw error;
    }
}

/**
 * Step 2: Processes the extracted text using DEEPSEEK V3.
 */
export const processStatement = async (content: { text: string; }): Promise<GeminiResponse> => {
    const systemPrompt = `Bạn là Chuyên gia Kế toán Cao cấp (ACCAR). Nhiệm vụ: Chuyển đổi văn bản sao kê ngân hàng thô thành JSON cấu trúc sổ cái.

    CẤU TRÚC JSON BẮT BUỘC (RESPONSE SCHEMA):
    {
        "openingBalance": number, // Số dư đầu kỳ (tìm kỹ, mặc định 0)
        "endingBalance": number, // Số dư cuối kỳ (tìm kỹ, mặc định 0)
        "accountInfo": {
            "accountName": string,
            "accountNumber": string,
            "bankName": string,
            "branch": string
        },
        "transactions": [
            {
                "transactionCode": string,
                "date": string, // DD/MM/YYYY
                "description": string,
                "debit": number, // Tiền vào (Ngân hàng ghi Có -> Sổ cái ghi Nợ)
                "credit": number, // Tiền ra GỐC (Ngân hàng ghi Nợ -> Sổ cái ghi Có). KHÔNG bao gồm phí/thuế.
                "fee": number, // Phí giao dịch tách riêng
                "vat": number // Thuế tách riêng
            }
        ]
    }

    QUY TẮC NGHIỆP VỤ (QUAN TRỌNG):
    1. **Tách Phí & Thuế**: Nếu dòng giao dịch có phí/VAT, hãy tách riêng ra khỏi số tiền gốc (\`credit\`).
       - VD: Giao dịch gốc 10tr, phí 11k (10k phí + 1k VAT).
       - JSON: { "credit": 10000000, "fee": 10000, "vat": 1000, "debit": 0 }
    2. **Định dạng Số**: Xử lý dấu phân cách ngàn (,) và thập phân (.) theo chuẩn Việt Nam.
    3. **Đảo Nợ/Có**: 
       - Sao kê ghi "C" (Credit/Tiền vào) -> JSON \`debit\` (Tăng tiền).
       - Sao kê ghi "D" (Debit/Tiền ra) -> JSON \`credit\` (Giảm tiền).
    4. **Chính xác tuyệt đối**: Không làm tròn số, không bỏ sót số 0.`;

    const userPrompt = `Phân tích nội dung sao kê sau và trả về JSON:\n\n${content.text}`;

    try {
        const jsonString = await callDeepSeek([
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ]);

        if (!jsonString) throw new Error("DeepSeek trả về rỗng.");
        
        // DeepSeek đôi khi trả về markdown ```json ... ```, cần làm sạch
        const cleanJson = jsonString.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanJson) as GeminiResponse;
    } catch (error) {
        console.error("DeepSeek Processing Error:", error);
        throw new Error("Lỗi xử lý DeepSeek. Vui lòng kiểm tra DEEPSEEK_API_KEY.");
    }
};

/**
 * Chat Assistant using DEEPSEEK V3.
 */
export const chatWithAI = async (
    message: string,
    currentReport: GeminiResponse,
    chatHistory: ChatMessage[],
    rawStatementContent: string,
    image: { mimeType: string; data: string } | null
): Promise<AIChatResponse> => {

    // Chuyển đổi lịch sử chat sang định dạng DeepSeek (user/assistant)
    const formattedHistory = chatHistory.map(msg => ({
        role: msg.role === 'model' ? 'assistant' : 'user',
        content: msg.content
    }));

    const systemPrompt = `Bạn là "Trợ lý Kế toán của Anh Cường".
    1. Luôn xưng "Em", gọi "Anh Cường".
    2. Trả về JSON theo schema sau (KHÔNG trả về text thường):
    {
        "responseText": string, // Câu trả lời hội thoại
        "action": "update" | "undo" | "add" | "query",
        "update": { "index": number, "field": string, "newValue": number } | null,
        "add": { ...Transaction object... } | null,
        "confirmationRequired": boolean
    }
    3. Nếu Anh Cường muốn sửa/thêm/xóa -> Tạo object update/add tương ứng, đặt confirmationRequired=true.
    4. Nếu chỉ hỏi -> action="query", confirmationRequired=false.
    
    Dữ liệu hiện tại: ${JSON.stringify(currentReport)}`;

    const messages = [
        { role: "system", content: systemPrompt },
        ...formattedHistory,
        { role: "user", content: message } // DeepSeek V3 text-only cho chat logic
    ];

    // Lưu ý: DeepSeek V3 API hiện tại không hỗ trợ gửi ảnh trực tiếp trong mảng messages như Gemini.
    // Nếu có ảnh (image), chúng ta chỉ có thể mô tả rằng người dùng đã gửi ảnh.
    if (image) {
        messages[messages.length - 1].content += "\n[Người dùng có đính kèm một hình ảnh, nhưng Em chỉ xử lý được văn bản lúc này.]";
    }

    try {
        const jsonString = await callDeepSeek(messages, true);
        const cleanJson = jsonString.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanJson) as AIChatResponse;
    } catch (error) {
        console.error("DeepSeek Chat Error:", error);
        return { responseText: "DeepSeek đang bận, Anh Cường thử lại sau nhé.", action: 'query' };
    }
};
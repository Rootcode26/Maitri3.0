import type { RequestHandler } from 'express';

export const supportedLanguages = ['en', 'hi', 'mr'] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

type Dictionary = Record<string, string>;

const hi: Dictionary = {
  'Internal server error': 'आंतरिक सर्वर त्रुटि',
  'Authentication token has expired': 'प्रमाणीकरण टोकन की अवधि समाप्त हो गई है',
  'Authentication token is not active yet': 'प्रमाणीकरण टोकन अभी सक्रिय नहीं है',
  'Authentication token is invalid': 'प्रमाणीकरण टोकन अमान्य है',
  'Request validation failed': 'अनुरोध सत्यापन विफल रहा',
  'Request body contains invalid JSON': 'अनुरोध में अमान्य JSON है',
  'Request body exceeds the allowed size': 'अनुरोध अनुमत आकार से बड़ा है',
  'Request failed': 'अनुरोध विफल रहा',
  'A file is required': 'एक फ़ाइल आवश्यक है',
  'Document validation is not configured': 'दस्तावेज़ सत्यापन कॉन्फ़िगर नहीं है',
  'The validation service is unavailable': 'सत्यापन सेवा उपलब्ध नहीं है',
  'The approval service is temporarily unavailable': 'अनुमोदन सेवा अस्थायी रूप से उपलब्ध नहीं है',
  'Food-related licence': 'खाद्य-संबंधित लाइसेंस',
  'Factory registration': 'कारखाना पंजीकरण',
  'Fire safety NOC': 'अग्नि सुरक्षा अनापत्ति प्रमाणपत्र',
  'Consent to operate': 'संचालन की सहमति',
  'Boiler registration': 'बॉयलर पंजीकरण',
  'Food premises plan': 'खाद्य परिसर योजना',
  'Authorised signatory identity proof': 'अधिकृत हस्ताक्षरकर्ता का पहचान प्रमाण',
  'Factory floor plan': 'कारखाने की तल योजना',
  'Machinery list': 'मशीनरी सूची',
  'Workforce summary': 'कार्यबल सारांश',
  'Evacuation plan': 'निकासी योजना',
  'Fire architectural drawings': 'अग्नि सुरक्षा वास्तु चित्र',
  'Process note': 'प्रक्रिया विवरण',
  'Water balance': 'जल संतुलन',
  'Waste declaration': 'अपशिष्ट घोषणा',
  'Boiler drawing': 'बॉयलर चित्र',
  'Manufacturer / inspection test records': 'निर्माता / निरीक्षण परीक्षण अभिलेख',
  'Maharashtra Pollution Control Board (MPCB)': 'महाराष्ट्र प्रदूषण नियंत्रण मंडल (MPCB)',
  'Directorate of Industrial Safety and Health (DISH)':
    'औद्योगिक सुरक्षा एवं स्वास्थ्य निदेशालय (DISH)',
  'Food Safety and Standards Authority of India (FSSAI)':
    'भारतीय खाद्य सुरक्षा एवं मानक प्राधिकरण (FSSAI)',
  'Fire and Emergency Services': 'अग्निशमन एवं आपातकालीन सेवाएँ',
  'Directorate of Steam Boilers': 'वाष्प बॉयलर निदेशालय',
  'The primary activity does not belong to the selected industry.':
    'मुख्य गतिविधि चयनित उद्योग से संबंधित नहीं है।',
  'Correct the industry or primary activity.': 'उद्योग या मुख्य गतिविधि ठीक करें।',
  'The PAN embedded in GSTIN differs from the entered PAN.':
    'GSTIN में मौजूद PAN दर्ज किए गए PAN से अलग है।',
  'Check both identifiers and enter values for the same business.':
    'दोनों पहचान संख्याएँ जाँचें और उसी व्यवसाय के मान दर्ज करें।',
  'Boiler capacity is required when a boiler is present.': 'बॉयलर होने पर उसकी क्षमता आवश्यक है।',
  'Select the boiler capacity.': 'बॉयलर की क्षमता चुनें।',
  'The regulatory engine has blocked submission.': 'नियामक इंजन ने आवेदन जमा करना रोक दिया है।',
  'Resolve the regulatory review before submission.': 'जमा करने से पहले नियामक समीक्षा पूरी करें।',
};

const mr: Dictionary = {
  'Internal server error': 'अंतर्गत सर्व्हर त्रुटी',
  'Authentication token has expired': 'प्रमाणीकरण टोकनची मुदत संपली आहे',
  'Authentication token is not active yet': 'प्रमाणीकरण टोकन अद्याप सक्रिय नाही',
  'Authentication token is invalid': 'प्रमाणीकरण टोकन अवैध आहे',
  'Request validation failed': 'विनंती पडताळणी अयशस्वी झाली',
  'Request body contains invalid JSON': 'विनंतीमध्ये अवैध JSON आहे',
  'Request body exceeds the allowed size': 'विनंती अनुमत आकारापेक्षा मोठी आहे',
  'Request failed': 'विनंती अयशस्वी झाली',
  'A file is required': 'फाइल आवश्यक आहे',
  'Document validation is not configured': 'कागदपत्र पडताळणी संरचीत केलेली नाही',
  'The validation service is unavailable': 'पडताळणी सेवा उपलब्ध नाही',
  'The approval service is temporarily unavailable': 'मंजुरी सेवा तात्पुरती उपलब्ध नाही',
  'Food-related licence': 'अन्न-संबंधित परवाना',
  'Factory registration': 'कारखाना नोंदणी',
  'Fire safety NOC': 'अग्निसुरक्षा ना-हरकत प्रमाणपत्र',
  'Consent to operate': 'संचालनासाठी संमती',
  'Boiler registration': 'बॉयलर नोंदणी',
  'Food premises plan': 'अन्न परिसर आराखडा',
  'Authorised signatory identity proof': 'अधिकृत स्वाक्षरीकर्त्याचा ओळख पुरावा',
  'Factory floor plan': 'कारखान्याचा मजला आराखडा',
  'Machinery list': 'यंत्रसामग्री यादी',
  'Workforce summary': 'मनुष्यबळ सारांश',
  'Evacuation plan': 'निर्वासन आराखडा',
  'Fire architectural drawings': 'अग्निसुरक्षा वास्तुचित्रे',
  'Process note': 'प्रक्रिया विवरण',
  'Water balance': 'जल संतुलन',
  'Waste declaration': 'कचरा घोषणा',
  'Boiler drawing': 'बॉयलर चित्र',
  'Manufacturer / inspection test records': 'उत्पादक / तपासणी चाचणी नोंदी',
  'Maharashtra Pollution Control Board (MPCB)': 'महाराष्ट्र प्रदूषण नियंत्रण मंडळ (MPCB)',
  'Directorate of Industrial Safety and Health (DISH)':
    'औद्योगिक सुरक्षा व आरोग्य संचालनालय (DISH)',
  'Food Safety and Standards Authority of India (FSSAI)':
    'भारतीय अन्न सुरक्षा व मानके प्राधिकरण (FSSAI)',
  'Fire and Emergency Services': 'अग्निशमन व आपत्कालीन सेवा',
  'Directorate of Steam Boilers': 'वाफ बॉयलर संचालनालय',
  'The primary activity does not belong to the selected industry.':
    'मुख्य क्रियाकलाप निवडलेल्या उद्योगाशी संबंधित नाही.',
  'Correct the industry or primary activity.': 'उद्योग किंवा मुख्य क्रियाकलाप दुरुस्त करा.',
  'The PAN embedded in GSTIN differs from the entered PAN.':
    'GSTIN मधील PAN हा नोंदवलेल्या PAN पेक्षा वेगळा आहे.',
  'Check both identifiers and enter values for the same business.':
    'दोन्ही ओळख क्रमांक तपासा आणि त्याच व्यवसायाची माहिती भरा.',
  'Boiler capacity is required when a boiler is present.':
    'बॉयलर असल्यास त्याची क्षमता आवश्यक आहे.',
  'Select the boiler capacity.': 'बॉयलरची क्षमता निवडा.',
  'The regulatory engine has blocked submission.': 'नियामक इंजिनने अर्ज सादर करणे रोखले आहे.',
  'Resolve the regulatory review before submission.':
    'अर्ज सादर करण्यापूर्वी नियामक परीक्षण पूर्ण करा.',
};

const dictionaries: Record<Exclude<SupportedLanguage, 'en'>, Dictionary> = { hi, mr };

export function resolveLanguage(
  acceptLanguage?: string,
  cookieLanguage?: string,
): SupportedLanguage {
  if (supportedLanguages.includes(cookieLanguage as SupportedLanguage)) {
    return cookieLanguage as SupportedLanguage;
  }
  const requested = (acceptLanguage ?? '')
    .split(',')
    .map((part) => part.trim().split(';')[0]?.toLowerCase().split('-')[0])
    .find((part) => supportedLanguages.includes(part as SupportedLanguage));
  return (requested as SupportedLanguage | undefined) ?? 'en';
}

export function translateSystemText(language: SupportedLanguage, value: string): string {
  if (language === 'en') return value;
  return dictionaries[language][value] ?? value;
}

export function localizePayload(language: SupportedLanguage, value: unknown): unknown {
  if (language === 'en') return value;
  if (typeof value === 'string') return translateSystemText(language, value);
  if (Array.isArray(value)) return value.map((item) => localizePayload(language, item));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, localizePayload(language, item)]),
    );
  }
  return value;
}

export const localizationMiddleware: RequestHandler = (request, response, next) => {
  const language = resolveLanguage(
    request.get('accept-language'),
    request.cookies?.udyogsetu_language as string | undefined,
  );
  response.setHeader('Content-Language', language);
  response.vary('Accept-Language');
  response.vary('Cookie');
  const sendJson = response.json.bind(response);
  response.json = ((body: unknown) =>
    sendJson(localizePayload(language, body))) as typeof response.json;
  next();
};

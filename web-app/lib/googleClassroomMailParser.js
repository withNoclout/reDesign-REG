function readString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function stripHtml(html) {
    return readString(html)
        ?.replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim() || '';
}

function extractEmailAddress(fromHeader) {
    const source = readString(fromHeader) || '';
    const match = source.match(/<([^>]+)>/);
    return (match?.[1] || source).trim().toLowerCase();
}

function extractUrls(text) {
    const source = readString(text) || '';
    const matches = source.match(/https?:\/\/[^\s)"'>]+/g);
    return matches || [];
}

function findClassroomUrl(message) {
    const candidates = [
        ...extractUrls(message.htmlBody),
        ...extractUrls(message.textBody),
        ...extractUrls(message.snippet),
    ];
    return candidates.find((url) => url.includes('classroom.google.com')) || candidates[0] || null;
}

function isClassroomCandidate({ senderEmail, subject, snippet, bodyText }) {
    const corpus = `${subject} ${snippet} ${bodyText}`.toLowerCase();
    const sender = senderEmail.toLowerCase();
    return sender.includes('classroom')
        || sender.includes('google.com') && corpus.includes('classroom')
        || corpus.includes('google classroom')
        || corpus.includes('classroom notification')
        || corpus.includes('assignment')
        || corpus.includes('ประกาศ')
        || corpus.includes('งาน');
}

function inferEventType(corpus) {
    if (/announcement|ประกาศ|posted a new announcement/i.test(corpus)) return 'announcement';
    if (/returned|graded|คะแนน|ส่งคืน|reviewed your work/i.test(corpus)) return 'returnedWork';
    if (/assignment|coursework|new work|งานใหม่|due/i.test(corpus)) return 'courseWork';
    return 'general';
}

function buildTitle(subject, eventType) {
    const normalizedSubject = readString(subject);
    if (normalizedSubject) return normalizedSubject;
    if (eventType === 'announcement') return 'มีประกาศใหม่จาก Google Classroom';
    if (eventType === 'returnedWork') return 'มีการส่งคืนงานจาก Google Classroom';
    if (eventType === 'courseWork') return 'มีงานใหม่จาก Google Classroom';
    return 'มีการแจ้งเตือนจาก Google Classroom';
}

function buildMessage(snippet, bodyText) {
    const source = readString(snippet) || readString(bodyText) || 'พบอีเมลแจ้งเตือนจาก Google Classroom';
    return source.replace(/\s+/g, ' ').trim().slice(0, 240);
}

function extractCourseHint(subject, snippet, bodyText) {
    const source = `${subject || ''} ${snippet || ''} ${bodyText || ''}`;
    const match = source.match(/(?:วิชา|course|class)\s*[:\-]?\s*([^\n|]+)/i);
    return readString(match?.[1] || '');
}

export function parseGoogleClassroomMailNotification(message) {
    const senderEmail = extractEmailAddress(message.headers?.from);
    const subject = readString(message.headers?.subject) || '';
    const snippet = readString(message.snippet) || '';
    const bodyText = [readString(message.textBody), stripHtml(message.htmlBody)].filter(Boolean).join(' ');

    if (!isClassroomCandidate({ senderEmail, subject, snippet, bodyText })) {
        return null;
    }

    const eventType = inferEventType(`${subject} ${snippet} ${bodyText}`);
    const href = findClassroomUrl(message) || 'https://classroom.google.com';
    const sortAt = Number.isFinite(Number(message.internalDate))
        ? new Date(Number(message.internalDate)).toISOString()
        : new Date().toISOString();

    return {
        id: `gmail-classroom:${message.id}`,
        gmailMessageId: message.id,
        gmailThreadId: message.threadId,
        sender: senderEmail,
        subject,
        snippet,
        sourceType: eventType,
        courseHint: extractCourseHint(subject, snippet, bodyText) || null,
        href,
        title: buildTitle(subject, eventType),
        message: buildMessage(snippet, bodyText),
        sortAt,
        resourceUpdatedAt: sortAt,
        payload: {
            labelIds: message.labelIds || [],
            historyId: message.historyId || null,
            headers: message.headers || {},
        },
    };
}

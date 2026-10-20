export function redactSensitiveData(data: any): any {
  if (typeof data === 'string') {
    return data
      .replace(/Bearer\s+[^\s]+/gi, 'Bearer [REDACTED]')
      .replace(/lyr_[a-zA-Z0-9_-]+/gi, '[REDACTED_API_KEY]')
      .replace(/(api[_-]?key|token|secret)[=:]\s*[^\s&]+/gi, '$1=[REDACTED]');
  }

  if (Array.isArray(data)) {
    return data.map(item => redactSensitiveData(item));
  }

  if (data && typeof data === 'object') {
    const redacted: any = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('token') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('key') ||
        lowerKey.includes('password') ||
        lowerKey.includes('authorization')
      ) {
        redacted[key] = '[REDACTED]';
      } else if (lowerKey.includes('url') && typeof value === 'string') {
        redacted[key] = redactSignedUrl(value);
      } else {
        redacted[key] = redactSensitiveData(value);
      }
    }
    return redacted;
  }

  return data;
}

export function redactSignedUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    if (urlObj.searchParams.has('token')) {
      urlObj.searchParams.set('token', '[REDACTED]');
    }
    if (urlObj.searchParams.has('signature')) {
      urlObj.searchParams.set('signature', '[REDACTED]');
    }
    return urlObj.toString();
  } catch {
    return url;
  }
}

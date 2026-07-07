import { NextResponse } from 'next/server';
import fs from 'fs';

export async function GET() {
  try {
    const logPath = 'C:\\Users\\Administrador TI\\.gemini\\antigravity\\brain\\9ff60112-3558-491d-8689-95131c307342\\.system_generated\\logs\\transcript_full.jsonl';
    const data = fs.readFileSync(logPath, 'utf8');
    const lines = data.split('\n').filter(Boolean);
    
    let result = "NOT FOUND";
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i]);
        if (entry.type === 'USER_INPUT') {
          result = entry.content;
          break;
        }
      } catch (e) {}
    }
    
    return new NextResponse(result, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });
  } catch (error) {
    return new NextResponse(String(error), { status: 500 });
  }
}

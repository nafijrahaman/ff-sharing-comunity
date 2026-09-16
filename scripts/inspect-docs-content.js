const fs = require('fs');

const content = fs.readFileSync('scripts/nrdb_docs_chunk.js', 'utf8');

// Extract all string literals
const stringRegex = /"([^"\\]*(?:\\.[^"\\]*)*)"/g;
let match;
const strings = [];
while ((match = stringRegex.exec(content)) !== null) {
  if (match[1].length > 10) {
    strings.push(match[1]);
  }
}

console.log('Total doc strings:', strings.length);
console.log('\n--- KEY SECTIONS & CODE EXAMPLES ---');
strings.filter(s => 
  s.includes('POST') || 
  s.includes('GET') || 
  s.includes('DELETE') || 
  s.includes('PUT') || 
  s.includes('PATCH') ||
  s.includes('collection') ||
  s.includes('query') ||
  s.includes('filter') ||
  s.includes('quick') ||
  s.includes('limit')
).slice(0, 40).forEach(s => console.log('•', s));

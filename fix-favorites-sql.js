const fs = require('fs');

const file = 'C:\\Users\\Administrator\\WorkBuddy\\2026-05-13-task-2\\cf100-push\\insert-7788-full.sql';
let sql = fs.readFileSync(file, 'utf8');

// Split into lines
const lines = sql.split('\n');
const newLines = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // If it's a favorites INSERT with search_title in columns, remove that column
  if (line.includes('INSERT OR IGNORE INTO favorites') && line.includes('search_title')) {
    const fixed = line.replace(', search_title', '');
    newLines.push(fixed);
    continue;
  }
  
  // If it's a VALUES line for favorites that has an extra value (search_title), remove it
  if (line.startsWith("VALUES ('7788'") && i > 0 && lines[i-1].includes('INSERT OR IGNORE INTO favorites')) {
    // Count how many values should be there
    // Normal favorites: username, key, title, source_name, cover, year, total_episodes, save_time = 8 values
    // With search_title: 9 values
    // We need to remove the last value before the closing );
    
    // Find the last comma before );
    const endIdx = line.lastIndexOf(');');
    const lastCommaIdx = line.lastIndexOf(',', endIdx);
    if (lastCommaIdx !== -1) {
      const fixed = line.substring(0, lastCommaIdx) + line.substring(endIdx);
      newLines.push(fixed);
      continue;
    }
  }
  
  newLines.push(line);
}

fs.writeFileSync(file, newLines.join('\n'), 'utf8');
console.log('Fixed favorites INSERT statements - removed search_title column.');

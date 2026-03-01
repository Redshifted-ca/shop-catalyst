// fix-auth.js
const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Pattern 1: getSession()
  if (content.includes('getSession()')) {
    content = content.replace(
      /const\s+{\s*data:\s*{\s*session\s*}\s*}\s*=\s*await\s+supabase\.auth\.getSession\(\)/g,
      'const { data: { user } } = await supabase.auth.getUser()'
    );
    
    // Also replace session?.user with just user
    content = content.replace(/session\?\.user/g, 'user');
    
    modified = true;
  }

  // Pattern 2: onAuthStateChange using session.user
  if (content.includes('session?.user')) {
    content = content.replace(/session\?\.user/g, 'user');
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ Fixed: ${filePath}`);
  }
}

// Find all .tsx and .ts files in app directory
function walkDir(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      walkDir(filePath);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      replaceInFile(filePath);
    }
  });
}

console.log('Fixing auth patterns...\n');
walkDir('./app');
walkDir('./components');
console.log('\nDone!');
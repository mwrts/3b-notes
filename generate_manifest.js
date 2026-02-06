const fs = require('fs');
const path = require('path');

const notesDir = path.join(__dirname, 'notes');
const outputFile = path.join(__dirname, 'manifest.json');

function getFiles(dir) {
    const results = [];
    const list = fs.readdirSync(dir);

    list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat && stat.isDirectory()) {
            results.push({
                type: 'directory',
                name: file,
                children: getFiles(filePath)
            });
        } else if (file.endsWith('.md')) {
            results.push({
                type: 'file',
                name: file,
                path: path.relative(path.join(__dirname, 'notes'), filePath).replace(/\\/g, '/')
            });
        }
    });

    // Sort: Directories first, then files, both alphabetical
    results.sort((a, b) => {
        if (a.type === b.type) {
            return a.name.localeCompare(b.name);
        }
        return a.type === 'directory' ? -1 : 1;
    });

    return results;
}

if (!fs.existsSync(notesDir)) {
    console.log('Notes directory not found.');
    fs.writeFileSync(outputFile, JSON.stringify([], null, 2));
} else {
    const tree = getFiles(notesDir);
    fs.writeFileSync(outputFile, JSON.stringify(tree, null, 2));
    console.log('Manifest generated:', outputFile);
}

document.addEventListener('DOMContentLoaded', () => {
    const fileTree = document.getElementById('file-tree');
    const viewer = document.getElementById('markdown-viewer');
    const themeToggle = document.getElementById('theme-toggle');

    // Theme Handling
    const storedTheme = localStorage.getItem('theme') ||
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

    document.documentElement.setAttribute('data-theme', storedTheme);

    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    });

    // File Mapping for WikiLinks
    const fileMap = new Map(); // Name -> Path

    // Fetch Manifest
    fetch('manifest.json')
        .then(response => {
            if (!response.ok) {
                // Return empty if not found (first run or error)
                return [];
            }
            return response.json();
        })
        .then(data => {
            fileTree.innerHTML = ''; // Clear loading
            if (data.length === 0) {
                fileTree.innerHTML = '<div style="padding:1rem;">Nenhuma nota encontrada.</div>';
                return;
            }
            buildSidebar(data, fileTree);
            buildFileMap(data);
        })
        .catch(err => {
            console.error('Error loading manifest:', err);
            fileTree.innerHTML = '<div style="padding:1rem; color:red;">Erro ao carregar notas.</div>';
        });

    function buildFileMap(items) {
        items.forEach(item => {
            if (item.type === 'file') {
                // Store "Filename" -> "path/to/Filename.md"
                // Remove extension for key
                const baseName = item.name.replace(/\.md$/i, '');
                fileMap.set(baseName, item.path);
            } else if (item.children) {
                buildFileMap(item.children);
            }
        });
    }

    function buildSidebar(items, container) {
        const ul = document.createElement('div');
        ul.className = 'folder-group';

        items.forEach(item => {
            if (item.type === 'directory') {
                const folderDiv = document.createElement('div');
                folderDiv.className = 'folder';
                // By default folders are closed

                const header = document.createElement('div');
                header.className = 'folder-header';
                header.innerHTML = `
                    <svg class="folder-arrow" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M10 17l5-5-5-5v10z"/>
                    </svg>
                    <span>${item.name}</span>
                `;
                header.addEventListener('click', (e) => {
                    e.stopPropagation();
                    folderDiv.classList.toggle('open');
                });

                const content = document.createElement('div');
                content.className = 'folder-content';

                folderDiv.appendChild(header);
                folderDiv.appendChild(content);

                // Recursively build children
                if (item.children && item.children.length > 0) {
                    buildSidebar(item.children, content);
                }

                container.appendChild(folderDiv);

            } else if (item.type === 'file') {
                const fileLink = document.createElement('a');
                fileLink.className = 'file-item';
                fileLink.textContent = item.name.replace('.md', ''); // specific aesthetic preference? usually sidebar shows nice names
                fileLink.href = '#';
                fileLink.dataset.path = item.path;

                fileLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    // Set active class
                    document.querySelectorAll('.file-item').forEach(el => el.classList.remove('active'));
                    fileLink.classList.add('active');

                    loadNote(item.path);
                });

                container.appendChild(fileLink);
            }
        });
    }

    function loadNote(path) {
        // Path is relative to notes/
        // But we need to fetch it. Markdown files are static files served by GitHub Pages.
        // We assume 'notes/' directory is served at root/notes/

        const fetchPath = `notes/${path}`;

        fetch(fetchPath)
            .then(res => {
                if (!res.ok) throw new Error('File not found');
                return res.text();
            })
            .then(md => {
                renderMarkdown(md);
            })
            .catch(err => {
                viewer.innerHTML = `<h1>Erro</h1><p>Não foi possível carregar a nota: ${err.message}</p>`;
            });
    }

    function renderMarkdown(md) {
        // 1. Pre-process WikiLinks [[Link]]
        // Replacer callback
        const processedMd = md.replace(/\[\[(.*?)\]\]/g, (match, p1) => {
            // p1 is "LinkName" or "LinkName|Label"
            let linkTarget = p1;
            let linkLabel = p1;

            if (p1.includes('|')) {
                const parts = p1.split('|');
                linkTarget = parts[0];
                linkLabel = parts[1];
            }

            // Find target in map
            const targetPath = fileMap.get(linkTarget);

            if (targetPath) {
                // We do a hack: we use a specific class to handle these clicks specifically if we wanted,
                // but since we render generic HTML, we can just use href="#" and onclick handler 
                // BUT adding onclick handler to string is messy.
                // Better: data attribute.
                return `<a href="#" class="wiki-link" data-target="${targetPath}">${linkLabel}</a>`;
            } else {
                return `<span class="broken-link" title="Not found">${linkLabel}</span>`;
            }
        });

        // 2. Marked parse
        viewer.innerHTML = marked.parse(processedMd);

        // 3. Attach handlers to new links
        viewer.querySelectorAll('.wiki-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const target = link.dataset.target;
                loadNote(target);
                // Also update sidebar active state? (Optional, might be slow to search DOM)
            });
        });

        // 4. MathJax Typeset
        if (window.MathJax) {
            window.MathJax.typesetPromise([viewer]).then(() => {
                // MathJax done
            });
        }
    }
});

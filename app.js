document.addEventListener('DOMContentLoaded', () => {
    const fileTree = document.getElementById('file-tree');
    const viewer = document.getElementById('markdown-viewer');
    const themeToggle = document.getElementById('theme-toggle');

    // Theme Handling (Default to Light if not set)
    const storedTheme = localStorage.getItem('theme') || 'light';

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
                // Map full name "foo.png" -> path
                fileMap.set(item.name, item.path);
                // Map basename "foo" -> path
                const baseName = item.name.replace(/\.[^/.]+$/, "");
                if (baseName !== item.name) {
                    fileMap.set(baseName, item.path);
                }
            } else if (item.children) {
                buildFileMap(item.children);
            }
        });
    }

    function buildSidebar(items, container) {
        // Sort items: directories first, then files
        items.sort((a, b) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === 'directory' ? -1 : 1;
        });

        items.forEach(item => {
            if (item.type === 'directory') {
                const folderDiv = document.createElement('div');
                folderDiv.className = 'folder';

                const header = document.createElement('div');
                header.className = 'folder-header';

                // Caret Icon
                const caret = document.createElement('i');
                caret.className = 'ph ph-caret-right folder-arrow';

                // Folder Icon
                const icon = document.createElement('i');
                icon.className = 'ph ph-folder folder-icon';

                // Name Span
                const nameSpan = document.createElement('span');
                nameSpan.textContent = item.name;

                header.appendChild(caret);
                header.appendChild(icon);
                header.appendChild(nameSpan);

                header.addEventListener('click', (e) => {
                    e.stopPropagation();
                    folderDiv.classList.toggle('open');
                    // Toggle Caret
                    if (folderDiv.classList.contains('open')) {
                        caret.classList.replace('ph-caret-right', 'ph-caret-down');
                        icon.classList.replace('ph-folder', 'ph-folder-open');
                    } else {
                        caret.classList.replace('ph-caret-down', 'ph-caret-right');
                        icon.classList.replace('ph-folder', 'ph-folder');
                    }
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
                fileLink.href = '#';
                fileLink.dataset.path = item.path;

                // Determine icon based on extension
                let iconClass = 'ph-file-text';
                const lowerName = item.name.toLowerCase();
                if (lowerName.endsWith('.png') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg') || lowerName.endsWith('.gif')) {
                    iconClass = 'ph-image';
                } else if (lowerName.endsWith('.html')) {
                    iconClass = 'ph-globe';
                }

                fileLink.innerHTML = `<i class="ph ${iconClass} file-icon"></i> <span>${item.name.replace(/\.[^/.]+$/, "")}</span>`;

                fileLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    document.querySelectorAll('.file-item').forEach(el => el.classList.remove('active'));
                    fileLink.classList.add('active');
                    loadNote(item.path);
                });

                container.appendChild(fileLink);
            }
        });
    }

    function loadNote(path) {
        const fetchPath = `notes/${path}`;
        const lowerPath = path.toLowerCase();

        // Check file type
        if (lowerPath.endsWith('.png') || lowerPath.endsWith('.jpg') || lowerPath.endsWith('.jpeg') || lowerPath.endsWith('.gif')) {
            viewer.innerHTML = `
                <div style="display: flex; justify-content: center; align-items: center; height: 100%;">
                    <img src="${fetchPath}" alt="${path}" style="max-width: 100%; max-height: 80vh; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                </div>
            `;
            return;
        }

        if (lowerPath.endsWith('.html')) {
            fetch(fetchPath)
                .then(res => {
                    if (!res.ok) throw new Error('File not found');
                    return res.text();
                })
                .then(html => {
                    // Render HTML directly. Warning: XSS risk if self-notes are malicious.
                    // Assuming trusted environment.
                    viewer.innerHTML = html;
                })
                .catch(err => {
                    viewer.innerHTML = `<h1>Erro</h1><p>Não foi possível carregar o arquivo HTML: ${err.message}</p>`;
                });
            return;
        }

        // Default: Markdown
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
        let processedMd = md;

        // 1. Pre-process Image Embeds ![[Link|Size]]
        processedMd = processedMd.replace(/!\[\[(.*?)\]\]/g, (match, p1) => {
            let linkTarget = p1;
            let linkMeta = '';

            if (p1.includes('|')) {
                const parts = p1.split('|');
                linkTarget = parts[0];
                linkMeta = parts[1];
            }

            const targetPath = fileMap.get(linkTarget);

            if (targetPath) {
                let style = '';
                // Handle size (e.g., "300" or "300x200" - simplistic handling for width)
                if (/^\d+$/.test(linkMeta)) {
                    style = `width: ${linkMeta}px; max-width: 100%;`;
                }

                return `<img src="notes/${targetPath}" alt="${linkTarget}" style="${style}" class="embedded-image">`;
            }
            // If not found, show broken image
            return `<span class="broken-image" style="color:red; font-size:0.8em;">⚠️ Imagem não encontrada: ${linkTarget}</span>`;
        });

        // 2. Pre-process WikiLinks [[Link]]
        processedMd = processedMd.replace(/\[\[(.*?)\]\]/g, (match, p1) => {
            let linkTarget = p1;
            let linkLabel = p1;

            if (p1.includes('|')) {
                const parts = p1.split('|');
                linkTarget = parts[0];
                linkLabel = parts[1];
            }

            const targetPath = fileMap.get(linkTarget);

            if (targetPath) {
                return `<a href="#" class="wiki-link" data-target="${targetPath}">${linkLabel}</a>`;
            } else {
                return `<span class="broken-link" title="Not found">${linkLabel}</span>`;
            }
        });

        // 3. Pre-process Highlights ==text==
        processedMd = processedMd.replace(/==(.*?)==/g, '<mark>$1</mark>');

        // 4. Pre-process Comments %%text%%
        processedMd = processedMd.replace(/%%[\s\S]*?%%/g, '');

        // 5. Marked parse
        viewer.innerHTML = marked.parse(processedMd);

        // 5. Attach handlers to new links
        viewer.querySelectorAll('.wiki-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const target = link.dataset.target;
                loadNote(target);
            });
        });

        // 6. MathJax Typeset
        if (window.MathJax) {
            window.MathJax.typesetPromise([viewer]).then(() => {
                // MathJax done
            });
        }
    }
});

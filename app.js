// ===== Config =====
const USERNAME = '68110923';
const GITHUB_API = 'https://api.github.com';
const GITHUB_PAGES = `https://${USERNAME}.github.io`;

const LANG_COLORS = {
    JavaScript: '#f7df1e', TypeScript: '#3178c6', Python: '#3572a5', Go: '#00add8',
    Rust: '#dea584', Java: '#b07219', Kotlin: '#a97bff', Swift: '#f05138',
    'C++': '#f34b7d', C: '#555555', 'C#': '#178600', PHP: '#4f5d95',
    Ruby: '#701516', Shell: '#89e051', HTML: '#e34c26', CSS: '#563d7c',
    Vue: '#4fc08d', Dart: '#00b4ab', Lua: '#000080', Scala: '#c22d40',
    Haskell: '#5e5086', Elixir: '#6e4a7e', Perl: '#0298c3', R: '#198ce7',
    Dockerfile: '#384d54', Makefile: '#427819', Solidity: '#c67436',
};
const DEFAULT_LANG_COLOR = '#8b8b8b';

// ===== State =====
let allRepos = [];
let filteredRepos = [];
let currentFilter = 'all';
let currentSort = 'updated';
let searchQuery = '';

// ===== DOM Ref =====
const grid = document.getElementById('projectGrid');
const searchInput = document.getElementById('searchInput');
const sortSelect = document.getElementById('sortSelect');
const filterBtns = document.querySelectorAll('.filter-btn');

// ===== Helpers =====
function relativeTime(dateStr) {
    const now = Date.now();
    const d = new Date(dateStr).getTime();
    const diff = Math.max(0, now - d);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '刚刚';
    if (mins < 60) return mins + ' 分钟前';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + ' 小时前';
    const days = Math.floor(hrs / 24);
    if (days < 30) return days + ' 天前';
    const months = Math.floor(days / 30);
    if (months < 12) return months + ' 个月前';
    return Math.floor(months / 12) + ' 年前';
}

function truncate(str, len) {
    if (!str) return '';
    return str.length > len ? str.slice(0, len) + '…' : str;
}

// ===== Fetch =====
async function fetchUser() {
    const res = await fetch(`${GITHUB_API}/users/${USERNAME}`);
    if (!res.ok) throw new Error('Failed to fetch user');
    return res.json();
}

async function fetchRepos() {
    let all = [];
    let page = 1;
    while (true) {
        const res = await fetch(`${GITHUB_API}/users/${USERNAME}/repos?per_page=100&page=${page}&sort=updated`);
        if (!res.ok) throw new Error('Failed to fetch repos');
        const data = await res.json();
        if (!data.length) break;
        all = all.concat(data);
        page++;
    }
    return all;
}

// ===== Render =====
function renderCards(repos) {
    if (!repos.length) {
        grid.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-folder-open"></i>
                <h3>没有找到匹配的项目</h3>
                <p>尝试修改搜索条件或筛选器</p>
            </div>`;
        return;
    }

    grid.innerHTML = repos.map((r, i) => {
        const hasPages = r.has_pages;
        const linkUrl = hasPages ? `${GITHUB_PAGES}/${r.name}/` : r.html_url;
        const linkLabel = hasPages ? '访问 Pages' : '查看源码';
        const langColor = LANG_COLORS[r.language] || DEFAULT_LANG_COLOR;
        const isPrivate = r.private;
        const description = truncate(r.description || 'No description provided', 120);
        const delay = Math.min(i * 0.05, 0.6);

        return `
            <div class="project-card" style="animation-delay:${delay}s">
                <div class="card-top">
                    <div class="repo-name">
                        <span class="lang-dot" style="background:${langColor}"></span>
                        <span>${r.name}</span>
                        <i class="fa-solid fa-arrow-up-right-from-square"></i>
                    </div>
                    <div class="card-badges">
                        ${hasPages ? '<span class="badge badge-pages">Pages</span>' : ''}
                        ${isPrivate ? '<span class="badge badge-private">Private</span>' : '<span class="badge badge-public">Public</span>'}
                    </div>
                </div>
                <div class="repo-desc">${description}</div>
                <div class="card-meta">
                    <span><i class="fa-solid fa-star" style="color:#fbbf24"></i> ${r.stargazers_count}</span>
                    <span><i class="fa-solid fa-code-fork" style="color:#94a3b8"></i> ${r.forks_count}</span>
                    ${r.language ? `<span><i class="fa-solid fa-circle" style="color:${langColor};font-size:0.5rem;vertical-align:middle"></i> ${r.language}</span>` : ''}
                    <span><i class="fa-regular fa-clock"></i> ${relativeTime(r.pushed_at)}</span>
                    <a href="${linkUrl}" target="_blank" rel="noopener" class="card-link">
                        ${linkLabel} <i class="fa-solid fa-arrow-right"></i>
                    </a>
                </div>
            </div>`;
    }).join('');
}

function showSkeleton() {
    grid.innerHTML = Array(6).fill(`
        <div class="skeleton-card">
            <div class="skeleton skeleton-line short"></div>
            <div class="skeleton skeleton-line" style="margin-top:16px"></div>
            <div class="skeleton skeleton-line long"></div>
            <div class="skeleton skeleton-line" style="width:50%;margin-top:16px"></div>
        </div>
    `).join('');
}

function showError(msg) {
    grid.innerHTML = `
        <div class="error-state">
            <i class="fa-solid fa-triangle-exclamation"></i>
            <h3>加载失败</h3>
            <p>${msg || '无法获取项目数据，请检查网络连接'}</p>
            <button class="retry-btn" onclick="init()"><i class="fa-solid fa-rotate"></i> 重试</button>
        </div>`;
}

// ===== Filter & Sort =====
function applyFilterAndSort() {
    let list = [...allRepos];

    if (currentFilter === 'pages') {
        list = list.filter(r => r.has_pages);
    } else if (currentFilter === 'nopages') {
        list = list.filter(r => !r.has_pages);
    } else if (currentFilter === 'public') {
        list = list.filter(r => !r.private);
    }

    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        list = list.filter(r =>
            r.name.toLowerCase().includes(q) ||
            (r.description && r.description.toLowerCase().includes(q)) ||
            (r.language && r.language.toLowerCase().includes(q)) ||
            (r.topics && r.topics.some(t => t.includes(q)))
        );
    }

    if (currentSort === 'stars') {
        list.sort((a, b) => b.stargazers_count - a.stargazers_count);
    } else if (currentSort === 'name') {
        list.sort((a, b) => a.name.localeCompare(b.name));
    } else {
        list.sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at));
    }

    filteredRepos = list;
    renderCards(list);
}

// ===== Stats =====
function updateStats(repos, user) {
    document.getElementById('statRepos').textContent = repos.length;
    const totalStars = repos.reduce((s, r) => s + r.stargazers_count, 0);
    document.getElementById('statStars').textContent = totalStars;
    const totalForks = repos.reduce((s, r) => s + r.forks_count, 0);
    document.getElementById('statForks').textContent = totalForks;
    const pagesCount = repos.filter(r => r.has_pages).length;
    document.getElementById('statPages').textContent = pagesCount;

    if (user) {
        document.getElementById('heroName').textContent = user.login;
        document.getElementById('heroBio').textContent = user.bio || 'Developer · Open Source Enthusiast';
        document.getElementById('avatarImg').src = user.avatar_url;
    }
}

// ===== Init =====
async function init() {
    showSkeleton();
    try {
        const [user, repos] = await Promise.all([fetchUser(), fetchRepos()]);
        allRepos = repos.filter(r => !r.fork && r.name !== `${USERNAME}.github.io`);
        updateStats(allRepos, user);
        applyFilterAndSort();
    } catch (e) {
        console.error(e);
        showError(e.message);
    }
}

// ===== Events =====
searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    applyFilterAndSort();
});

sortSelect.addEventListener('change', (e) => {
    currentSort = e.target.value;
    applyFilterAndSort();
});

filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        applyFilterAndSort();
    });
});

// ===== Theme =====
const themeToggle = document.getElementById('themeToggle');
const themeIcon = themeToggle.querySelector('i');

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    themeIcon.className = theme === 'dark' ? 'fa-regular fa-sun' : 'fa-regular fa-moon';
}

themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    setTheme(current === 'dark' ? 'light' : 'dark');
});

const savedTheme = localStorage.getItem('theme') || 'dark';
setTheme(savedTheme);

// Footer year
document.getElementById('footerYear').textContent = new Date().getFullYear();

// Start
init();

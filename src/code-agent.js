const fs = require('fs');
const path = require('path');

const CodeAgent = {
  projectRoot: process.cwd(),

  async analyze(targetPath, options = {}) {
    const {
      depth = 'medium',
      focus = null
    } = options;

    const fullPath = path.isAbsolute(targetPath) 
      ? targetPath 
      : path.join(this.projectRoot, targetPath);

    if (!fs.existsSync(fullPath)) {
      return { error: `Path does not exist: ${fullPath}` };
    }

    const stats = fs.statSync(fullPath);
    const isDir = stats.isDirectory();

    const analysis = {
      timestamp: new Date().toISOString(),
      target: targetPath,
      type: isDir ? 'directory' : 'file',
      results: {}
    };

    if (isDir) {
      analysis.results.structure = await this.analyzeStructure(fullPath, depth);
    } else {
      analysis.results.file = await this.analyzeFile(fullPath, focus);
    }

    return analysis;
  },

  async analyzeStructure(dirPath, depth) {
    const structure = {
      files: [],
      summary: { total: 0, byType: {} }
    };

    const collectFiles = (dir, prefix = '') => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        if (entry.name.startsWith('.') && entry.name !== '.env.example') continue;

        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          structure.files.push({ type: 'directory', name: entry.name, path: fullPath });
          if (depth === 'medium' || depth === 'deep') {
            collectFiles(fullPath, prefix + '  ');
          }
        } else {
          const ext = path.extname(entry.name).slice(1) || 'no-ext';
          structure.files.push({ type: 'file', name: entry.name, path: fullPath, ext });
          structure.summary.byType[ext] = (structure.summary.byType[ext] || 0) + 1;
          structure.summary.total++;
        }
      }
    };

    collectFiles(dirPath);
    return structure;
  },

  async analyzeFile(filePath, focus = null) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const ext = path.extname(filePath).slice(1);
    
    const analysis = {
      lines: content.split('\n').length,
      size: fs.statSync(filePath).size,
      language: this.detectLanguage(ext),
      metrics: this.calculateMetrics(content, ext),
      findings: []
    };

    if (focus === 'security') {
      analysis.findings = this.checkSecurity(content, filePath);
    } else if (focus === 'quality') {
      analysis.findings = this.checkCodeQuality(content, filePath);
    } else if (focus === 'patterns') {
      analysis.findings = this.checkPatterns(content, filePath);
    } else {
      analysis.findings = [
        ...this.checkSecurity(content, filePath),
        ...this.checkCodeQuality(content, filePath),
        ...this.checkPatterns(content, filePath)
      ];
    }

    return analysis;
  },

  detectLanguage(ext) {
    const langMap = {
      js: 'JavaScript',
      json: 'JSON',
      html: 'HTML',
      css: 'CSS',
      md: 'Markdown',
      yml: 'YAML'
    };
    return langMap[ext] || ext.toUpperCase();
  },

  calculateMetrics(content, ext) {
    const lines = content.split('\n');
    const nonEmpty = lines.filter(l => l.trim().length > 0);
    const comments = lines.filter(l => {
      const trimmed = l.trim();
      return trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*');
    });

    return {
      totalLines: lines.length,
      nonEmptyLines: nonEmpty.length,
      commentLines: comments.length,
      commentRatio: comments.length / lines.length
    };
  },

  checkSecurity(content, filePath) {
    const findings = [];
    const patterns = [
      { regex: /process\.env\.\w+/g, issue: 'Environment variable access', severity: 'info' },
      { regex: /password|secret|token|key/gi, issue: 'Potential secret/credential', severity: 'warning' },
      { regex: /eval\s*\(/g, issue: 'Use of eval()', severity: 'high' },
      { regex: /innerHTML\s*=/g, issue: 'Direct innerHTML assignment (XSS risk)', severity: 'medium' },
      { regex: /SELECT.*\+.*FROM|INSERT.*\+.*VALUES/g, issue: 'Potential SQL injection', severity: 'high' },
      { regex: /TODO|FIXME|HACK/gi, issue: 'Code TODO/FIXME marker', severity: 'info' }
    ];

    for (const { regex, issue, severity } of patterns) {
      const matches = content.match(regex);
      if (matches) {
        findings.push({ issue, severity, count: matches.length, locations: matches.slice(0, 3) });
      }
    }

    return findings;
  },

  checkCodeQuality(content, filePath) {
    const findings = [];
    const lines = content.split('\n');

    let openBraces = 0;
    let openParens = 0;
    let openBrackets = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      openBraces += (line.match(/{/g) || []).length;
      openBraces -= (line.match(/}/g) || []).length;
      openParens += (line.match(/\(/g) || []).length;
      openParens -= (line.match(/\)/g) || []).length;
      openBrackets += (line.match(/\[/g) || []).length;
      openBrackets -= (line.match(/\]/g) || []).length;

      if (line.length > 120) {
        findings.push({ issue: 'Long line detected', severity: 'low', line: i + 1, detail: line.substring(0, 50) + '...' });
      }
    }

    if (openBraces !== 0) findings.push({ issue: 'Mismatched curly braces', severity: 'medium' });
    if (openParens !== 0) findings.push({ issue: 'Mismatched parentheses', severity: 'medium' });
    if (openBrackets !== 0) findings.push({ issue: 'Mismatched brackets', severity: 'medium' });

    const hasStrictMode = content.includes('"use strict"') || content.includes("'use strict'");
    if (filePath.endsWith('.js') && !hasStrictMode) {
      findings.push({ issue: 'Missing "use strict" directive', severity: 'low' });
    }

    return findings;
  },

  checkPatterns(content, filePath) {
    const findings = [];
    const patterns = [
      { regex: /function\s+\w+\s*\(/g, type: 'function declarations' },
      { regex: /const\s+\w+\s*=\s*(async\s+)?\(/g, type: 'arrow functions assigned to const' },
      { regex: /class\s+\w+/g, type: 'class definitions' },
      { regex: /require\s*\(/g, type: 'CommonJS imports' },
      { regex: /module\.exports/g, type: 'CommonJS exports' },
      { regex: /async\s+function/g, type: 'async functions' },
      { regex: /try\s*{/g, type: 'try-catch blocks' },
      { regex: /catch\s*\(/g, type: 'catch blocks' }
    ];

    for (const { regex, type } of patterns) {
      const matches = content.match(regex);
      if (matches) {
        findings.push({ pattern: type, count: matches.length });
      }
    }

    return findings;
  },

  async findFiles(pattern, options = {}) {
    const { recursive = true } = options;
    const results = [];
    
    const search = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory() && recursive) {
          search(fullPath);
        } else if (entry.isFile()) {
          const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
          if (regex.test(entry.name)) {
            results.push(fullPath);
          }
        }
      }
    };

    search(this.projectRoot);
    return results;
  },

  async searchCode(query, options = {}) {
    const { include = '*', exclude = ['node_modules', '.git'] } = options;
    const results = [];

    const searchInFile = (filePath) => {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      const regex = new RegExp(query, 'gi');
      
      for (let i = 0; i < lines.length; i++) {
        if (regex.test(lines[i])) {
          results.push({
            file: filePath,
            line: i + 1,
            content: lines[i].trim()
          });
        }
        regex.lastIndex = 0;
      }
    };

    const search = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (exclude.includes(entry.name)) continue;
        
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          search(fullPath);
        } else if (entry.isFile() && this.matchesPattern(entry.name, include)) {
          searchInFile(fullPath);
        }
      }
    };

    search(this.projectRoot);
    return results;
  },

  matchesPattern(filename, pattern) {
    if (pattern === '*') return true;
    const patterns = pattern.split(',').map(p => p.trim());
    return patterns.some(p => {
      const regex = new RegExp('^' + p.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
      return regex.test(filename);
    });
  },

  generateReport(analysis) {
    let report = `Code Analysis Report
====================
Target: ${analysis.target}
Type: ${analysis.type}
Generated: ${analysis.timestamp}

`;

    if (analysis.results.structure) {
      const s = analysis.results.structure;
      report += `Structure:
---------
Total Files: ${s.summary.total}
By Extension: ${JSON.stringify(s.summary.byType)}

`;
    }

    if (analysis.results.file) {
      const f = analysis.results.file;
      report += `File Analysis:
-------------
Language: ${f.language}
Lines: ${f.lines} (${f.metrics.nonEmptyLines} non-empty, ${f.metrics.commentLines} comments)
Size: ${f.size} bytes

Findings (${f.findings.length}):
${f.findings.map(ff => `  [${ff.severity.toUpperCase()}] ${ff.issue}${ff.count ? ` (${ff.count} matches)` : ''}`).join('\n')}
`;
    }

    return report;
  }
};

module.exports = CodeAgent;

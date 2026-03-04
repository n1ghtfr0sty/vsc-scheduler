const CodeAgent = require('./code-agent');

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  if (!command) {
    console.log('Usage: node src/code-agent.js <command> [options]');
    console.log('');
    console.log('Commands:');
    console.log('  analyze <path>        Analyze a file or directory');
    console.log('  search <query>        Search for code pattern');
    console.log('  find <pattern>        Find files matching pattern');
    console.log('');
    console.log('Options:');
    console.log('  --focus=security      Focus on security issues');
    console.log('  --focus=quality       Focus on code quality');
    console.log('  --focus=patterns      Focus on code patterns');
    console.log('  --include=*.js        File pattern to search');
    console.log('  --depth=shallow      Directory traversal depth');
    console.log('');
    console.log('Examples:');
    console.log('  node src/code-agent.js analyze src/routes');
    console.log('  node src/code-agent.js analyze src/index.js --focus=security');
    console.log('  node src/code-agent.js search "async function"');
    console.log('  node src/code-agent.js find "*.js"');
    process.exit(1);
  }

  const options = {};
  for (const arg of args.slice(1)) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      options[key] = value === undefined ? true : value;
    }
  }

  switch (command) {
    case 'analyze': {
      const target = args.slice(1).find(a => !a.startsWith('--')) || '.';
      const result = await CodeAgent.analyze(target, {
        focus: options.focus,
        depth: options.depth || 'medium'
      });
      console.log(CodeAgent.generateReport(result));
      break;
    }

    case 'search': {
      const query = args.slice(1).find(a => !a.startsWith('--'));
      if (!query) {
        console.error('Error: search query required');
        process.exit(1);
      }
      const results = await CodeAgent.searchCode(query, { include: options.include || '*' });
      console.log(`Found ${results.length} matches for "${query}":\n`);
      for (const r of results.slice(0, 50)) {
        console.log(`${r.file}:${r.line}: ${r.content}`);
      }
      if (results.length > 50) {
        console.log(`\n... and ${results.length - 50} more`);
      }
      break;
    }

    case 'find': {
      const pattern = args.slice(1).find(a => !a.startsWith('--'));
      if (!pattern) {
        console.error('Error: file pattern required');
        process.exit(1);
      }
      const results = await CodeAgent.findFiles(pattern);
      console.log(`Found ${results.length} files matching "${pattern}":\n`);
      for (const r of results) {
        console.log(r);
      }
      break;
    }

    default:
      console.log(`Unknown command: ${command}`);
      process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

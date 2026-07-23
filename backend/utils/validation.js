import path from "path";

/**
 * Validates a file's extension and matches its contents against language rules.
 * Returns { valid: true } or { valid: false, error: string }.
 */
export const validateFile = (filePath, content, labIdOrType, options = {}) => {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const idOrType = (labIdOrType || '').toLowerCase();

  // 1. Identify the Lab Group & Extension validation
  let allowedExtensions = [];
  let courseName = "";

  if (idOrType.includes('python')) {
    allowedExtensions = ['py'];
    courseName = "Python Programming Lab";
  } else if (idOrType.includes('java') || idOrType.includes('agile')) {
    allowedExtensions = ['java'];
    courseName = "Java Lab";
  } else if (idOrType.includes('android') || idOrType.includes('mobile')) {
    allowedExtensions = ['java', 'xml', 'gradle', 'properties', 'sh'];
    courseName = "Fundamental of Mobile (Android Lab)";
  } else if (idOrType.includes('bigdata') || idOrType.includes('big-data') || idOrType.includes('hadoop') || idOrType.includes('analytics')) {
    allowedExtensions = ['py', 'java', 'csv', 'txt', 'jar', 'xml', 'sh', 'json', 'log', 'parquet', 'avro', 'orc'];
    courseName = "Big Data Lab";
  } else if (idOrType.includes('linux') || idOrType.includes('shell')) {
    allowedExtensions = ['sh', 'txt', 'text', 'bash', 'cfg', 'conf', 'json', ''];
    courseName = "Linux Lab";
  } else if (
    idOrType.includes('dotnet') ||
    idOrType.includes('csharp') ||
    idOrType === 'cs' ||
    idOrType === 'c#'
  ) {
    allowedExtensions = ['cs', 'cshtml', 'razor', 'json', 'xml', 'csproj', 'sln', 'css', 'js', 'html', 'txt', 'config', 'props'];
    courseName = ".NET Lab";
  }

  // If a lab group is identified, validate the extension
  if (allowedExtensions.length > 0) {
    if (ext !== undefined && !allowedExtensions.includes(ext)) {
      return {
        valid: false,
        error: `Validation Error: Invalid file extension .${ext}. Only the following extensions are allowed for ${courseName}: ${allowedExtensions.map(e => `.${e}`).join(', ')}`
      };
    }
  }

  // 2. Content Validation based on Extension (Enforce language rules)
  if (content) {
    const codeStr = String(content);
    if (ext === 'java') {
      // Check if user wrote Python in a .java file
      const hasPythonPrint = /^\s*print\s*\(.*\)/m.test(codeStr) && !codeStr.includes('System.out');
      const hasPythonDef = /^\s*def\s+[a-zA-Z0-9_]+\s*\(.*\)\s*:/m.test(codeStr);
      const hasPythonCommentOnly = /^\s*#/m.test(codeStr) && !codeStr.includes('//') && !codeStr.includes('/*');
      const hasNoJavaClass = !/\bclass\b/.test(codeStr);

      if (hasPythonPrint || hasPythonDef || (hasPythonCommentOnly && hasNoJavaClass)) {
        return {
          valid: false,
          error: "Validation Error: File has a .java extension but contains Python or invalid code. Java files must follow Java syntax."
        };
      }

      // Check if public class name matches file name (ONLY on code execution/run, not on save)
      if (options.isRun) {
        const publicClassMatch = codeStr.match(/\bpublic\s+(?:(?:final|abstract)\s+)?class\s+([a-zA-Z0-9_]+)/);
        if (publicClassMatch) {
          const className = publicClassMatch[1];
          const fileName = path.basename(filePath, '.java');
          if (className !== fileName) {
            return {
              valid: false,
              error: `Validation Error: Class '${className}' is public, should be declared in a file named ${className}.java`
            };
          }
        }
      }
    }

    if (ext === 'py') {
      // Check if user wrote Java in a .py file
      const hasJavaClass = /\bpublic\s+class\s+[a-zA-Z0-9_]+/.test(codeStr);
      const hasJavaPrint = /System\.out\.print/.test(codeStr);
      const hasJavaImport = /import\s+[a-zA-Z0-9_.]+\s*;\s*$/.test(codeStr);
      
      if (hasJavaClass || hasJavaPrint || hasJavaImport) {
        return {
          valid: false,
          error: "Validation Error: File has a .py extension but contains Java or invalid code. Python files must follow Python syntax."
        };
      }
    }

    if (ext === 'xml') {
      const trimmed = codeStr.trim();
      if (trimmed && (!trimmed.startsWith('<') || !trimmed.endsWith('>'))) {
        return {
          valid: false,
          error: "Validation Error: XML file must contain valid XML markup starting with '<' and ending with '>'."
        };
      }
    }
  }

  return { valid: true };
};

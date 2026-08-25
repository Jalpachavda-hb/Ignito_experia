export const SeleniumRuntime = {
  runtime: "java-selenium",
  compile: "javac {{entryFile}}",
  run: "java {{className}}"
};

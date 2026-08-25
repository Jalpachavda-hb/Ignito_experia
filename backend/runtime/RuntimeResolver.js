import { JavaRuntime } from "./JavaRuntime.js";
import { PythonRuntime } from "./PythonRuntime.js";
import { DotnetRuntime } from "./DotnetRuntime.js";
import { LinuxRuntime } from "./LinuxRuntime.js";
import { SeleniumRuntime } from "./SeleniumRuntime.js";

export class RuntimeResolver {
  static resolve(labType, language) {
    if (labType === "testing") {
      return SeleniumRuntime;
    }
    if (labType === "dotnet" || (labType === "code" && language === "csharp")) {
      return DotnetRuntime;
    }
    if (language === "java") {
      return JavaRuntime;
    }
    if (language === "python") {
      return PythonRuntime;
    }
    return LinuxRuntime;
  }
}

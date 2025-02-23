var NayukiCModule = function (NayukiCModule) {
  NayukiCModule = NayukiCModule || {};
  var Module = NayukiCModule;

  var Module;
  if (!Module) Module = (typeof NayukiCModule !== "undefined" ? NayukiCModule : null) || {};
  var moduleOverrides = {};
  for (var key in Module) {
    if (Module.hasOwnProperty(key)) {
      moduleOverrides[key] = Module[key];
    }
  }
  var ENVIRONMENT_IS_WEB = false;
  var ENVIRONMENT_IS_WORKER = false;
  var ENVIRONMENT_IS_NODE = false;
  var ENVIRONMENT_IS_SHELL = false;
  if (Module["ENVIRONMENT"]) {
    if (Module["ENVIRONMENT"] === "WEB") {
      ENVIRONMENT_IS_WEB = true;
    } else if (Module["ENVIRONMENT"] === "WORKER") {
      ENVIRONMENT_IS_WORKER = true;
    } else if (Module["ENVIRONMENT"] === "NODE") {
      ENVIRONMENT_IS_NODE = true;
    } else if (Module["ENVIRONMENT"] === "SHELL") {
      ENVIRONMENT_IS_SHELL = true;
    } else {
      throw new Error(
        "The provided Module['ENVIRONMENT'] value is not valid. It must be one of: WEB|WORKER|NODE|SHELL."
      );
    }
  } else {
    ENVIRONMENT_IS_WEB = typeof window === "object";
    ENVIRONMENT_IS_WORKER = typeof importScripts === "function";
    ENVIRONMENT_IS_NODE =
      typeof process === "object" && typeof require === "function" && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER;
    ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;
  }
  if (ENVIRONMENT_IS_NODE) {
    if (!Module["print"]) Module["print"] = console.log;
    if (!Module["printErr"]) Module["printErr"] = console.warn;
    var nodeFS;
    var nodePath;
    Module["read"] = function shell_read(filename, binary) {
      if (!nodeFS) nodeFS = require("fs");
      if (!nodePath) nodePath = require("path");
      filename = nodePath["normalize"](filename);
      var ret = nodeFS["readFileSync"](filename);
      return binary ? ret : ret.toString();
    };
    Module["readBinary"] = function readBinary(filename) {
      var ret = Module["read"](filename, true);
      if (!ret.buffer) {
        ret = new Uint8Array(ret);
      }
      assert(ret.buffer);
      return ret;
    };
    Module["load"] = function load(f) {
      globalEval(read(f));
    };
    if (!Module["thisProgram"]) {
      if (process["argv"].length > 1) {
        Module["thisProgram"] = process["argv"][1].replace(/\\/g, "/");
      } else {
        Module["thisProgram"] = "unknown-program";
      }
    }
    Module["arguments"] = process["argv"].slice(2);
    process["on"]("uncaughtException", function (ex) {
      if (!(ex instanceof ExitStatus)) {
        throw ex;
      }
    });
    Module["inspect"] = function () {
      return "[Emscripten Module object]";
    };
  } else if (ENVIRONMENT_IS_SHELL) {
    if (!Module["print"] && typeof print != "undefined") Module["print"] = print;
    if (typeof printErr != "undefined") Module["printErr"] = printErr;
    if (typeof read != "undefined") {
      Module["read"] = read;
    } else {
      Module["read"] = function shell_read() {
        throw "no read() available";
      };
    }
    Module["readBinary"] = function readBinary(f) {
      if (typeof readbuffer === "function") {
        return new Uint8Array(readbuffer(f));
      }
      var data = read(f, "binary");
      assert(typeof data === "object");
      return data;
    };
    if (typeof scriptArgs != "undefined") {
      Module["arguments"] = scriptArgs;
    } else if (typeof arguments != "undefined") {
      Module["arguments"] = arguments;
    }
    if (typeof quit === "function") {
      Module["quit"] = function (status, toThrow) {
        quit(status);
      };
    }
  } else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
    Module["read"] = function shell_read(url) {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", url, false);
      xhr.send(null);
      return xhr.responseText;
    };
    if (ENVIRONMENT_IS_WORKER) {
      Module["readBinary"] = function readBinary(url) {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", url, false);
        xhr.responseType = "arraybuffer";
        xhr.send(null);
        return new Uint8Array(xhr.response);
      };
    }
    Module["readAsync"] = function readAsync(url, onload, onerror) {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", url, true);
      xhr.responseType = "arraybuffer";
      xhr.onload = function xhr_onload() {
        if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) {
          onload(xhr.response);
        } else {
          onerror();
        }
      };
      xhr.onerror = onerror;
      xhr.send(null);
    };
    if (typeof arguments != "undefined") {
      Module["arguments"] = arguments;
    }
    if (typeof console !== "undefined") {
      if (!Module["print"])
        Module["print"] = function shell_print(x) {
          console.log(x);
        };
      if (!Module["printErr"])
        Module["printErr"] = function shell_printErr(x) {
          console.warn(x);
        };
    } else {
      var TRY_USE_DUMP = false;
      if (!Module["print"])
        Module["print"] =
          TRY_USE_DUMP && typeof dump !== "undefined"
            ? function (x) {
                dump(x);
              }
            : function (x) {};
    }
    if (ENVIRONMENT_IS_WORKER) {
      Module["load"] = importScripts;
    }
    if (typeof Module["setWindowTitle"] === "undefined") {
      Module["setWindowTitle"] = function (title) {
        document.title = title;
      };
    }
  } else {
    throw "Unknown runtime environment. Where are we?";
  }
  function globalEval(x) {
    eval.call(null, x);
  }
  if (!Module["load"] && Module["read"]) {
    Module["load"] = function load(f) {
      globalEval(Module["read"](f));
    };
  }
  if (!Module["print"]) {
    Module["print"] = function () {};
  }
  if (!Module["printErr"]) {
    Module["printErr"] = Module["print"];
  }
  if (!Module["arguments"]) {
    Module["arguments"] = [];
  }
  if (!Module["thisProgram"]) {
    Module["thisProgram"] = "./this.program";
  }
  if (!Module["quit"]) {
    Module["quit"] = function (status, toThrow) {
      throw toThrow;
    };
  }
  Module.print = Module["print"];
  Module.printErr = Module["printErr"];
  Module["preRun"] = [];
  Module["postRun"] = [];
  for (var key in moduleOverrides) {
    if (moduleOverrides.hasOwnProperty(key)) {
      Module[key] = moduleOverrides[key];
    }
  }
  moduleOverrides = undefined;
  var Runtime = {
    setTempRet0: function (value) {
      tempRet0 = value;
      return value;
    },
    getTempRet0: function () {
      return tempRet0;
    },
    stackSave: function () {
      return STACKTOP;
    },
    stackRestore: function (stackTop) {
      STACKTOP = stackTop;
    },
    getNativeTypeSize: function (type) {
      switch (type) {
        case "i1":
        case "i8":
          return 1;
        case "i16":
          return 2;
        case "i32":
          return 4;
        case "i64":
          return 8;
        case "float":
          return 4;
        case "double":
          return 8;
        default: {
          if (type[type.length - 1] === "*") {
            return Runtime.QUANTUM_SIZE;
          } else if (type[0] === "i") {
            var bits = parseInt(type.substr(1));
            assert(bits % 8 === 0);
            return bits / 8;
          } else {
            return 0;
          }
        }
      }
    },
    getNativeFieldSize: function (type) {
      return Math.max(Runtime.getNativeTypeSize(type), Runtime.QUANTUM_SIZE);
    },
    STACK_ALIGN: 16,
    prepVararg: function (ptr, type) {
      if (type === "double" || type === "i64") {
        if (ptr & 7) {
          assert((ptr & 7) === 4);
          ptr += 4;
        }
      } else {
        assert((ptr & 3) === 0);
      }
      return ptr;
    },
    getAlignSize: function (type, size, vararg) {
      if (!vararg && (type == "i64" || type == "double")) return 8;
      if (!type) return Math.min(size, 8);
      return Math.min(size || (type ? Runtime.getNativeFieldSize(type) : 0), Runtime.QUANTUM_SIZE);
    },
    dynCall: function (sig, ptr, args) {
      if (args && args.length) {
        return Module["dynCall_" + sig].apply(null, [ptr].concat(args));
      } else {
        return Module["dynCall_" + sig].call(null, ptr);
      }
    },
    functionPointers: [],
    addFunction: function (func) {
      for (var i = 0; i < Runtime.functionPointers.length; i++) {
        if (!Runtime.functionPointers[i]) {
          Runtime.functionPointers[i] = func;
          return 2 * (1 + i);
        }
      }
      throw "Finished up all reserved function pointers. Use a higher value for RESERVED_FUNCTION_POINTERS.";
    },
    removeFunction: function (index) {
      Runtime.functionPointers[(index - 2) / 2] = null;
    },
    warnOnce: function (text) {
      if (!Runtime.warnOnce.shown) Runtime.warnOnce.shown = {};
      if (!Runtime.warnOnce.shown[text]) {
        Runtime.warnOnce.shown[text] = 1;
        Module.printErr(text);
      }
    },
    funcWrappers: {},
    getFuncWrapper: function (func, sig) {
      if (!func) return;
      assert(sig);
      if (!Runtime.funcWrappers[sig]) {
        Runtime.funcWrappers[sig] = {};
      }
      var sigCache = Runtime.funcWrappers[sig];
      if (!sigCache[func]) {
        if (sig.length === 1) {
          sigCache[func] = function dynCall_wrapper() {
            return Runtime.dynCall(sig, func);
          };
        } else if (sig.length === 2) {
          sigCache[func] = function dynCall_wrapper(arg) {
            return Runtime.dynCall(sig, func, [arg]);
          };
        } else {
          sigCache[func] = function dynCall_wrapper() {
            return Runtime.dynCall(sig, func, Array.prototype.slice.call(arguments));
          };
        }
      }
      return sigCache[func];
    },
    getCompilerSetting: function (name) {
      throw "You must build with -s RETAIN_COMPILER_SETTINGS=1 for Runtime.getCompilerSetting or emscripten_get_compiler_setting to work";
    },
    stackAlloc: function (size) {
      var ret = STACKTOP;
      STACKTOP = (STACKTOP + size) | 0;
      STACKTOP = (STACKTOP + 15) & -16;
      return ret;
    },
    staticAlloc: function (size) {
      var ret = STATICTOP;
      STATICTOP = (STATICTOP + size) | 0;
      STATICTOP = (STATICTOP + 15) & -16;
      return ret;
    },
    dynamicAlloc: function (size) {
      var ret = HEAP32[DYNAMICTOP_PTR >> 2];
      var end = ((ret + size + 15) | 0) & -16;
      HEAP32[DYNAMICTOP_PTR >> 2] = end;
      if (end >= TOTAL_MEMORY) {
        var success = enlargeMemory();
        if (!success) {
          HEAP32[DYNAMICTOP_PTR >> 2] = ret;
          return 0;
        }
      }
      return ret;
    },
    alignMemory: function (size, quantum) {
      var ret = (size = Math.ceil(size / (quantum ? quantum : 16)) * (quantum ? quantum : 16));
      return ret;
    },
    makeBigInt: function (low, high, unsigned) {
      var ret = unsigned ? +(low >>> 0) + +(high >>> 0) * +4294967296 : +(low >>> 0) + +(high | 0) * +4294967296;
      return ret;
    },
    GLOBAL_BASE: 8,
    QUANTUM_SIZE: 4,
    __dummy__: 0,
  };
  Module["Runtime"] = Runtime;
  var ABORT = 0;
  var EXITSTATUS = 0;
  function assert(condition, text) {
    if (!condition) {
      abort("Assertion failed: " + text);
    }
  }
  function getCFunc(ident) {
    var func = Module["_" + ident];
    if (!func) {
      try {
        func = eval("_" + ident);
      } catch (e) {}
    }
    assert(func, "Cannot call unknown function " + ident + " (perhaps LLVM optimizations or closure removed it?)");
    return func;
  }
  var cwrap, ccall;
  (function () {
    var JSfuncs = {
      stackSave: function () {
        Runtime.stackSave();
      },
      stackRestore: function () {
        Runtime.stackRestore();
      },
      arrayToC: function (arr) {
        var ret = Runtime.stackAlloc(arr.length);
        writeArrayToMemory(arr, ret);
        return ret;
      },
      stringToC: function (str) {
        var ret = 0;
        if (str !== null && str !== undefined && str !== 0) {
          var len = (str.length << 2) + 1;
          ret = Runtime.stackAlloc(len);
          stringToUTF8(str, ret, len);
        }
        return ret;
      },
    };
    var toC = { string: JSfuncs["stringToC"], array: JSfuncs["arrayToC"] };
    ccall = function ccallFunc(ident, returnType, argTypes, args, opts) {
      var func = getCFunc(ident);
      var cArgs = [];
      var stack = 0;
      if (args) {
        for (var i = 0; i < args.length; i++) {
          var converter = toC[argTypes[i]];
          if (converter) {
            if (stack === 0) stack = Runtime.stackSave();
            cArgs[i] = converter(args[i]);
          } else {
            cArgs[i] = args[i];
          }
        }
      }
      var ret = func.apply(null, cArgs);
      if (returnType === "string") ret = Pointer_stringify(ret);
      if (stack !== 0) {
        if (opts && opts.async) {
          EmterpreterAsync.asyncFinalizers.push(function () {
            Runtime.stackRestore(stack);
          });
          return;
        }
        Runtime.stackRestore(stack);
      }
      return ret;
    };
    var sourceRegex = /^function\s*[a-zA-Z$_0-9]*\s*\(([^)]*)\)\s*{\s*([^*]*?)[\s;]*(?:return\s*(.*?)[;\s]*)?}$/;
    function parseJSFunc(jsfunc) {
      var parsed = jsfunc.toString().match(sourceRegex).slice(1);
      return { arguments: parsed[0], body: parsed[1], returnValue: parsed[2] };
    }
    var JSsource = null;
    function ensureJSsource() {
      if (!JSsource) {
        JSsource = {};
        for (var fun in JSfuncs) {
          if (JSfuncs.hasOwnProperty(fun)) {
            JSsource[fun] = parseJSFunc(JSfuncs[fun]);
          }
        }
      }
    }
    cwrap = function cwrap(ident, returnType, argTypes) {
      argTypes = argTypes || [];
      var cfunc = getCFunc(ident);
      var numericArgs = argTypes.every(function (type) {
        return type === "number";
      });
      var numericRet = returnType !== "string";
      if (numericRet && numericArgs) {
        return cfunc;
      }
      var argNames = argTypes.map(function (x, i) {
        return "$" + i;
      });
      var funcstr = "(function(" + argNames.join(",") + ") {";
      var nargs = argTypes.length;
      if (!numericArgs) {
        ensureJSsource();
        funcstr += "var stack = " + JSsource["stackSave"].body + ";";
        for (var i = 0; i < nargs; i++) {
          var arg = argNames[i],
            type = argTypes[i];
          if (type === "number") continue;
          var convertCode = JSsource[type + "ToC"];
          funcstr += "var " + convertCode.arguments + " = " + arg + ";";
          funcstr += convertCode.body + ";";
          funcstr += arg + "=(" + convertCode.returnValue + ");";
        }
      }
      var cfuncname = parseJSFunc(function () {
        return cfunc;
      }).returnValue;
      funcstr += "var ret = " + cfuncname + "(" + argNames.join(",") + ");";
      if (!numericRet) {
        var strgfy = parseJSFunc(function () {
          return Pointer_stringify;
        }).returnValue;
        funcstr += "ret = " + strgfy + "(ret);";
      }
      if (!numericArgs) {
        ensureJSsource();
        funcstr += JSsource["stackRestore"].body.replace("()", "(stack)") + ";";
      }
      funcstr += "return ret})";
      return eval(funcstr);
    };
  })();
  Module["ccall"] = ccall;
  Module["cwrap"] = cwrap;
  function setValue(ptr, value, type, noSafe) {
    type = type || "i8";
    if (type.charAt(type.length - 1) === "*") type = "i32";
    switch (type) {
      case "i1":
        HEAP8[ptr >> 0] = value;
        break;
      case "i8":
        HEAP8[ptr >> 0] = value;
        break;
      case "i16":
        HEAP16[ptr >> 1] = value;
        break;
      case "i32":
        HEAP32[ptr >> 2] = value;
        break;
      case "i64":
        (tempI64 = [
          value >>> 0,
          ((tempDouble = value),
          +Math_abs(tempDouble) >= +1
            ? tempDouble > +0
              ? (Math_min(+Math_floor(tempDouble / +4294967296), +4294967295) | 0) >>> 0
              : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / +4294967296) >>> 0
            : 0),
        ]),
          (HEAP32[ptr >> 2] = tempI64[0]),
          (HEAP32[(ptr + 4) >> 2] = tempI64[1]);
        break;
      case "float":
        HEAPF32[ptr >> 2] = value;
        break;
      case "double":
        HEAPF64[ptr >> 3] = value;
        break;
      default:
        abort("invalid type for setValue: " + type);
    }
  }
  Module["setValue"] = setValue;
  function getValue(ptr, type, noSafe) {
    type = type || "i8";
    if (type.charAt(type.length - 1) === "*") type = "i32";
    switch (type) {
      case "i1":
        return HEAP8[ptr >> 0];
      case "i8":
        return HEAP8[ptr >> 0];
      case "i16":
        return HEAP16[ptr >> 1];
      case "i32":
        return HEAP32[ptr >> 2];
      case "i64":
        return HEAP32[ptr >> 2];
      case "float":
        return HEAPF32[ptr >> 2];
      case "double":
        return HEAPF64[ptr >> 3];
      default:
        abort("invalid type for setValue: " + type);
    }
    return null;
  }
  Module["getValue"] = getValue;
  var ALLOC_NORMAL = 0;
  var ALLOC_STACK = 1;
  var ALLOC_STATIC = 2;
  var ALLOC_DYNAMIC = 3;
  var ALLOC_NONE = 4;
  Module["ALLOC_NORMAL"] = ALLOC_NORMAL;
  Module["ALLOC_STACK"] = ALLOC_STACK;
  Module["ALLOC_STATIC"] = ALLOC_STATIC;
  Module["ALLOC_DYNAMIC"] = ALLOC_DYNAMIC;
  Module["ALLOC_NONE"] = ALLOC_NONE;
  function allocate(slab, types, allocator, ptr) {
    var zeroinit, size;
    if (typeof slab === "number") {
      zeroinit = true;
      size = slab;
    } else {
      zeroinit = false;
      size = slab.length;
    }
    var singleType = typeof types === "string" ? types : null;
    var ret;
    if (allocator == ALLOC_NONE) {
      ret = ptr;
    } else {
      ret = [
        typeof _malloc === "function" ? _malloc : Runtime.staticAlloc,
        Runtime.stackAlloc,
        Runtime.staticAlloc,
        Runtime.dynamicAlloc,
      ][allocator === undefined ? ALLOC_STATIC : allocator](Math.max(size, singleType ? 1 : types.length));
    }
    if (zeroinit) {
      var ptr = ret,
        stop;
      assert((ret & 3) == 0);
      stop = ret + (size & ~3);
      for (; ptr < stop; ptr += 4) {
        HEAP32[ptr >> 2] = 0;
      }
      stop = ret + size;
      while (ptr < stop) {
        HEAP8[ptr++ >> 0] = 0;
      }
      return ret;
    }
    if (singleType === "i8") {
      if (slab.subarray || slab.slice) {
        HEAPU8.set(slab, ret);
      } else {
        HEAPU8.set(new Uint8Array(slab), ret);
      }
      return ret;
    }
    var i = 0,
      type,
      typeSize,
      previousType;
    while (i < size) {
      var curr = slab[i];
      if (typeof curr === "function") {
        curr = Runtime.getFunctionIndex(curr);
      }
      type = singleType || types[i];
      if (type === 0) {
        i++;
        continue;
      }
      if (type == "i64") type = "i32";
      setValue(ret + i, curr, type);
      if (previousType !== type) {
        typeSize = Runtime.getNativeTypeSize(type);
        previousType = type;
      }
      i += typeSize;
    }
    return ret;
  }
  Module["allocate"] = allocate;
  function getMemory(size) {
    if (!staticSealed) return Runtime.staticAlloc(size);
    if (!runtimeInitialized) return Runtime.dynamicAlloc(size);
    return _malloc(size);
  }
  Module["getMemory"] = getMemory;
  function Pointer_stringify(ptr, length) {
    if (length === 0 || !ptr) return "";
    var hasUtf = 0;
    var t;
    var i = 0;
    while (1) {
      t = HEAPU8[(ptr + i) >> 0];
      hasUtf |= t;
      if (t == 0 && !length) break;
      i++;
      if (length && i == length) break;
    }
    if (!length) length = i;
    var ret = "";
    if (hasUtf < 128) {
      var MAX_CHUNK = 1024;
      var curr;
      while (length > 0) {
        curr = String.fromCharCode.apply(String, HEAPU8.subarray(ptr, ptr + Math.min(length, MAX_CHUNK)));
        ret = ret ? ret + curr : curr;
        ptr += MAX_CHUNK;
        length -= MAX_CHUNK;
      }
      return ret;
    }
    return Module["UTF8ToString"](ptr);
  }
  Module["Pointer_stringify"] = Pointer_stringify;
  function AsciiToString(ptr) {
    var str = "";
    while (1) {
      var ch = HEAP8[ptr++ >> 0];
      if (!ch) return str;
      str += String.fromCharCode(ch);
    }
  }
  Module["AsciiToString"] = AsciiToString;
  function stringToAscii(str, outPtr) {
    return writeAsciiToMemory(str, outPtr, false);
  }
  Module["stringToAscii"] = stringToAscii;
  var UTF8Decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf8") : undefined;
  function UTF8ArrayToString(u8Array, idx) {
    var endPtr = idx;
    while (u8Array[endPtr]) ++endPtr;
    if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
      return UTF8Decoder.decode(u8Array.subarray(idx, endPtr));
    } else {
      var u0, u1, u2, u3, u4, u5;
      var str = "";
      while (1) {
        u0 = u8Array[idx++];
        if (!u0) return str;
        if (!(u0 & 128)) {
          str += String.fromCharCode(u0);
          continue;
        }
        u1 = u8Array[idx++] & 63;
        if ((u0 & 224) == 192) {
          str += String.fromCharCode(((u0 & 31) << 6) | u1);
          continue;
        }
        u2 = u8Array[idx++] & 63;
        if ((u0 & 240) == 224) {
          u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
        } else {
          u3 = u8Array[idx++] & 63;
          if ((u0 & 248) == 240) {
            u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | u3;
          } else {
            u4 = u8Array[idx++] & 63;
            if ((u0 & 252) == 248) {
              u0 = ((u0 & 3) << 24) | (u1 << 18) | (u2 << 12) | (u3 << 6) | u4;
            } else {
              u5 = u8Array[idx++] & 63;
              u0 = ((u0 & 1) << 30) | (u1 << 24) | (u2 << 18) | (u3 << 12) | (u4 << 6) | u5;
            }
          }
        }
        if (u0 < 65536) {
          str += String.fromCharCode(u0);
        } else {
          var ch = u0 - 65536;
          str += String.fromCharCode(55296 | (ch >> 10), 56320 | (ch & 1023));
        }
      }
    }
  }
  Module["UTF8ArrayToString"] = UTF8ArrayToString;
  function UTF8ToString(ptr) {
    return UTF8ArrayToString(HEAPU8, ptr);
  }
  Module["UTF8ToString"] = UTF8ToString;
  function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
    if (!(maxBytesToWrite > 0)) return 0;
    var startIdx = outIdx;
    var endIdx = outIdx + maxBytesToWrite - 1;
    for (var i = 0; i < str.length; ++i) {
      var u = str.charCodeAt(i);
      if (u >= 55296 && u <= 57343) u = (65536 + ((u & 1023) << 10)) | (str.charCodeAt(++i) & 1023);
      if (u <= 127) {
        if (outIdx >= endIdx) break;
        outU8Array[outIdx++] = u;
      } else if (u <= 2047) {
        if (outIdx + 1 >= endIdx) break;
        outU8Array[outIdx++] = 192 | (u >> 6);
        outU8Array[outIdx++] = 128 | (u & 63);
      } else if (u <= 65535) {
        if (outIdx + 2 >= endIdx) break;
        outU8Array[outIdx++] = 224 | (u >> 12);
        outU8Array[outIdx++] = 128 | ((u >> 6) & 63);
        outU8Array[outIdx++] = 128 | (u & 63);
      } else if (u <= 2097151) {
        if (outIdx + 3 >= endIdx) break;
        outU8Array[outIdx++] = 240 | (u >> 18);
        outU8Array[outIdx++] = 128 | ((u >> 12) & 63);
        outU8Array[outIdx++] = 128 | ((u >> 6) & 63);
        outU8Array[outIdx++] = 128 | (u & 63);
      } else if (u <= 67108863) {
        if (outIdx + 4 >= endIdx) break;
        outU8Array[outIdx++] = 248 | (u >> 24);
        outU8Array[outIdx++] = 128 | ((u >> 18) & 63);
        outU8Array[outIdx++] = 128 | ((u >> 12) & 63);
        outU8Array[outIdx++] = 128 | ((u >> 6) & 63);
        outU8Array[outIdx++] = 128 | (u & 63);
      } else {
        if (outIdx + 5 >= endIdx) break;
        outU8Array[outIdx++] = 252 | (u >> 30);
        outU8Array[outIdx++] = 128 | ((u >> 24) & 63);
        outU8Array[outIdx++] = 128 | ((u >> 18) & 63);
        outU8Array[outIdx++] = 128 | ((u >> 12) & 63);
        outU8Array[outIdx++] = 128 | ((u >> 6) & 63);
        outU8Array[outIdx++] = 128 | (u & 63);
      }
    }
    outU8Array[outIdx] = 0;
    return outIdx - startIdx;
  }
  Module["stringToUTF8Array"] = stringToUTF8Array;
  function stringToUTF8(str, outPtr, maxBytesToWrite) {
    return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
  }
  Module["stringToUTF8"] = stringToUTF8;
  function lengthBytesUTF8(str) {
    var len = 0;
    for (var i = 0; i < str.length; ++i) {
      var u = str.charCodeAt(i);
      if (u >= 55296 && u <= 57343) u = (65536 + ((u & 1023) << 10)) | (str.charCodeAt(++i) & 1023);
      if (u <= 127) {
        ++len;
      } else if (u <= 2047) {
        len += 2;
      } else if (u <= 65535) {
        len += 3;
      } else if (u <= 2097151) {
        len += 4;
      } else if (u <= 67108863) {
        len += 5;
      } else {
        len += 6;
      }
    }
    return len;
  }
  Module["lengthBytesUTF8"] = lengthBytesUTF8;
  var UTF16Decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf-16le") : undefined;
  function demangle(func) {
    var __cxa_demangle_func = Module["___cxa_demangle"] || Module["__cxa_demangle"];
    if (__cxa_demangle_func) {
      try {
        var s = func.substr(1);
        var len = lengthBytesUTF8(s) + 1;
        var buf = _malloc(len);
        stringToUTF8(s, buf, len);
        var status = _malloc(4);
        var ret = __cxa_demangle_func(buf, 0, 0, status);
        if (getValue(status, "i32") === 0 && ret) {
          return Pointer_stringify(ret);
        }
      } catch (e) {
      } finally {
        if (buf) _free(buf);
        if (status) _free(status);
        if (ret) _free(ret);
      }
      return func;
    }
    Runtime.warnOnce("warning: build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling");
    return func;
  }
  function demangleAll(text) {
    var regex = /__Z[\w\d_]+/g;
    return text.replace(regex, function (x) {
      var y = demangle(x);
      return x === y ? x : x + " [" + y + "]";
    });
  }
  function jsStackTrace() {
    var err = new Error();
    if (!err.stack) {
      try {
        throw new Error(0);
      } catch (e) {
        err = e;
      }
      if (!err.stack) {
        return "(no stack trace available)";
      }
    }
    return err.stack.toString();
  }
  function stackTrace() {
    var js = jsStackTrace();
    if (Module["extraStackTrace"]) js += "\n" + Module["extraStackTrace"]();
    return demangleAll(js);
  }
  Module["stackTrace"] = stackTrace;
  var HEAP, buffer, HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;
  function updateGlobalBufferViews() {
    Module["HEAP8"] = HEAP8 = new Int8Array(buffer);
    Module["HEAP16"] = HEAP16 = new Int16Array(buffer);
    Module["HEAP32"] = HEAP32 = new Int32Array(buffer);
    Module["HEAPU8"] = HEAPU8 = new Uint8Array(buffer);
    Module["HEAPU16"] = HEAPU16 = new Uint16Array(buffer);
    Module["HEAPU32"] = HEAPU32 = new Uint32Array(buffer);
    Module["HEAPF32"] = HEAPF32 = new Float32Array(buffer);
    Module["HEAPF64"] = HEAPF64 = new Float64Array(buffer);
  }
  var STATIC_BASE, STATICTOP, staticSealed;
  var STACK_BASE, STACKTOP, STACK_MAX;
  var DYNAMIC_BASE, DYNAMICTOP_PTR;
  STATIC_BASE = STATICTOP = STACK_BASE = STACKTOP = STACK_MAX = DYNAMIC_BASE = DYNAMICTOP_PTR = 0;
  staticSealed = false;
  function abortOnCannotGrowMemory() {
    abort(
      "Cannot enlarge memory arrays. Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value " +
        TOTAL_MEMORY +
        ", (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which allows increasing the size at runtime but prevents some optimizations, (3) set Module.TOTAL_MEMORY to a higher value before the program runs, or (4) if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 "
    );
  }
  function enlargeMemory() {
    abortOnCannotGrowMemory();
  }
  var TOTAL_STACK = Module["TOTAL_STACK"] || 5242880;
  var TOTAL_MEMORY = Module["TOTAL_MEMORY"] || 16777216;
  if (TOTAL_MEMORY < TOTAL_STACK)
    Module.printErr(
      "TOTAL_MEMORY should be larger than TOTAL_STACK, was " + TOTAL_MEMORY + "! (TOTAL_STACK=" + TOTAL_STACK + ")"
    );
  if (Module["buffer"]) {
    buffer = Module["buffer"];
  } else {
    {
      buffer = new ArrayBuffer(TOTAL_MEMORY);
    }
  }
  updateGlobalBufferViews();
  function getTotalMemory() {
    return TOTAL_MEMORY;
  }
  HEAP32[0] = 1668509029;
  HEAP16[1] = 25459;
  if (HEAPU8[2] !== 115 || HEAPU8[3] !== 99) throw "Runtime error: expected the system to be little-endian!";
  Module["HEAP"] = HEAP;
  Module["buffer"] = buffer;
  Module["HEAP8"] = HEAP8;
  Module["HEAP16"] = HEAP16;
  Module["HEAP32"] = HEAP32;
  Module["HEAPU8"] = HEAPU8;
  Module["HEAPU16"] = HEAPU16;
  Module["HEAPU32"] = HEAPU32;
  Module["HEAPF32"] = HEAPF32;
  Module["HEAPF64"] = HEAPF64;
  function callRuntimeCallbacks(callbacks) {
    while (callbacks.length > 0) {
      var callback = callbacks.shift();
      if (typeof callback == "function") {
        callback();
        continue;
      }
      var func = callback.func;
      if (typeof func === "number") {
        if (callback.arg === undefined) {
          Module["dynCall_v"](func);
        } else {
          Module["dynCall_vi"](func, callback.arg);
        }
      } else {
        func(callback.arg === undefined ? null : callback.arg);
      }
    }
  }
  var __ATPRERUN__ = [];
  var __ATINIT__ = [];
  var __ATMAIN__ = [];
  var __ATEXIT__ = [];
  var __ATPOSTRUN__ = [];
  var runtimeInitialized = false;
  var runtimeExited = false;
  function preRun() {
    if (Module["preRun"]) {
      if (typeof Module["preRun"] == "function") Module["preRun"] = [Module["preRun"]];
      while (Module["preRun"].length) {
        addOnPreRun(Module["preRun"].shift());
      }
    }
    callRuntimeCallbacks(__ATPRERUN__);
  }
  function ensureInitRuntime() {
    if (runtimeInitialized) return;
    runtimeInitialized = true;
    callRuntimeCallbacks(__ATINIT__);
  }
  function preMain() {
    callRuntimeCallbacks(__ATMAIN__);
  }
  function exitRuntime() {
    callRuntimeCallbacks(__ATEXIT__);
    runtimeExited = true;
  }
  function postRun() {
    if (Module["postRun"]) {
      if (typeof Module["postRun"] == "function") Module["postRun"] = [Module["postRun"]];
      while (Module["postRun"].length) {
        addOnPostRun(Module["postRun"].shift());
      }
    }
    callRuntimeCallbacks(__ATPOSTRUN__);
  }
  function addOnPreRun(cb) {
    __ATPRERUN__.unshift(cb);
  }
  Module["addOnPreRun"] = addOnPreRun;
  function addOnInit(cb) {
    __ATINIT__.unshift(cb);
  }
  Module["addOnInit"] = addOnInit;
  function addOnPreMain(cb) {
    __ATMAIN__.unshift(cb);
  }
  Module["addOnPreMain"] = addOnPreMain;
  function addOnExit(cb) {
    __ATEXIT__.unshift(cb);
  }
  Module["addOnExit"] = addOnExit;
  function addOnPostRun(cb) {
    __ATPOSTRUN__.unshift(cb);
  }
  Module["addOnPostRun"] = addOnPostRun;
  function intArrayFromString(stringy, dontAddNull, length) {
    var len = length > 0 ? length : lengthBytesUTF8(stringy) + 1;
    var u8array = new Array(len);
    var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
    if (dontAddNull) u8array.length = numBytesWritten;
    return u8array;
  }
  Module["intArrayFromString"] = intArrayFromString;
  function intArrayToString(array) {
    var ret = [];
    for (var i = 0; i < array.length; i++) {
      var chr = array[i];
      if (chr > 255) {
        chr &= 255;
      }
      ret.push(String.fromCharCode(chr));
    }
    return ret.join("");
  }
  Module["intArrayToString"] = intArrayToString;
  function writeStringToMemory(string, buffer, dontAddNull) {
    Runtime.warnOnce("writeStringToMemory is deprecated and should not be called! Use stringToUTF8() instead!");
    var lastChar, end;
    if (dontAddNull) {
      end = buffer + lengthBytesUTF8(string);
      lastChar = HEAP8[end];
    }
    stringToUTF8(string, buffer, Infinity);
    if (dontAddNull) HEAP8[end] = lastChar;
  }
  Module["writeStringToMemory"] = writeStringToMemory;
  function writeArrayToMemory(array, buffer) {
    HEAP8.set(array, buffer);
  }
  Module["writeArrayToMemory"] = writeArrayToMemory;
  function writeAsciiToMemory(str, buffer, dontAddNull) {
    for (var i = 0; i < str.length; ++i) {
      HEAP8[buffer++ >> 0] = str.charCodeAt(i);
    }
    if (!dontAddNull) HEAP8[buffer >> 0] = 0;
  }
  Module["writeAsciiToMemory"] = writeAsciiToMemory;
  if (!Math["imul"] || Math["imul"](4294967295, 5) !== -5)
    Math["imul"] = function imul(a, b) {
      var ah = a >>> 16;
      var al = a & 65535;
      var bh = b >>> 16;
      var bl = b & 65535;
      return (al * bl + ((ah * bl + al * bh) << 16)) | 0;
    };
  Math.imul = Math["imul"];
  if (!Math["fround"]) {
    var froundBuffer = new Float32Array(1);
    Math["fround"] = function (x) {
      froundBuffer[0] = x;
      return froundBuffer[0];
    };
  }
  Math.fround = Math["fround"];
  if (!Math["clz32"])
    Math["clz32"] = function (x) {
      x = x >>> 0;
      for (var i = 0; i < 32; i++) {
        if (x & (1 << (31 - i))) return i;
      }
      return 32;
    };
  Math.clz32 = Math["clz32"];
  if (!Math["trunc"])
    Math["trunc"] = function (x) {
      return x < 0 ? Math.ceil(x) : Math.floor(x);
    };
  Math.trunc = Math["trunc"];
  var Math_abs = Math.abs;
  var Math_cos = Math.cos;
  var Math_sin = Math.sin;
  var Math_tan = Math.tan;
  var Math_acos = Math.acos;
  var Math_asin = Math.asin;
  var Math_atan = Math.atan;
  var Math_atan2 = Math.atan2;
  var Math_exp = Math.exp;
  var Math_log = Math.log;
  var Math_sqrt = Math.sqrt;
  var Math_ceil = Math.ceil;
  var Math_floor = Math.floor;
  var Math_pow = Math.pow;
  var Math_imul = Math.imul;
  var Math_fround = Math.fround;
  var Math_round = Math.round;
  var Math_min = Math.min;
  var Math_clz32 = Math.clz32;
  var Math_trunc = Math.trunc;
  var runDependencies = 0;
  var runDependencyWatcher = null;
  var dependenciesFulfilled = null;
  function addRunDependency(id) {
    runDependencies++;
    if (Module["monitorRunDependencies"]) {
      Module["monitorRunDependencies"](runDependencies);
    }
  }
  Module["addRunDependency"] = addRunDependency;
  function removeRunDependency(id) {
    runDependencies--;
    if (Module["monitorRunDependencies"]) {
      Module["monitorRunDependencies"](runDependencies);
    }
    if (runDependencies == 0) {
      if (runDependencyWatcher !== null) {
        clearInterval(runDependencyWatcher);
        runDependencyWatcher = null;
      }
      if (dependenciesFulfilled) {
        var callback = dependenciesFulfilled;
        dependenciesFulfilled = null;
        callback();
      }
    }
  }
  Module["removeRunDependency"] = removeRunDependency;
  Module["preloadedImages"] = {};
  Module["preloadedAudios"] = {};
  var ASM_CONSTS = [];
  STATIC_BASE = Runtime.GLOBAL_BASE;
  STATICTOP = STATIC_BASE + 816;
  __ATINIT__.push();
  allocate(
    [
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 20, 3,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
    "i8",
    ALLOC_NONE,
    Runtime.GLOBAL_BASE
  );
  var tempDoublePtr = STATICTOP;
  STATICTOP += 16;
  function ___setErrNo(value) {
    if (Module["___errno_location"]) HEAP32[Module["___errno_location"]() >> 2] = value;
    return value;
  }
  function _emscripten_memcpy_big(dest, src, num) {
    HEAPU8.set(HEAPU8.subarray(src, src + num), dest);
    return dest;
  }
  DYNAMICTOP_PTR = allocate(1, "i32", ALLOC_STATIC);
  STACK_BASE = STACKTOP = Runtime.alignMemory(STATICTOP);
  STACK_MAX = STACK_BASE + TOTAL_STACK;
  DYNAMIC_BASE = Runtime.alignMemory(STACK_MAX);
  HEAP32[DYNAMICTOP_PTR >> 2] = DYNAMIC_BASE;
  staticSealed = true;
  Module.asmGlobalArg = {
    Math: Math,
    Int8Array: Int8Array,
    Int16Array: Int16Array,
    Int32Array: Int32Array,
    Uint8Array: Uint8Array,
    Uint16Array: Uint16Array,
    Uint32Array: Uint32Array,
    Float32Array: Float32Array,
    Float64Array: Float64Array,
    NaN: NaN,
    Infinity: Infinity,
  };
  Module.asmLibraryArg = {
    abort: abort,
    assert: assert,
    enlargeMemory: enlargeMemory,
    getTotalMemory: getTotalMemory,
    abortOnCannotGrowMemory: abortOnCannotGrowMemory,
    ___setErrNo: ___setErrNo,
    _emscripten_memcpy_big: _emscripten_memcpy_big,
    DYNAMICTOP_PTR: DYNAMICTOP_PTR,
    tempDoublePtr: tempDoublePtr,
    ABORT: ABORT,
    STACKTOP: STACKTOP,
    STACK_MAX: STACK_MAX,
  }; // EMSCRIPTEN_START_ASM
  var asm = (function (global, env, buffer) {
    "use asm";
    var a = new global.Int8Array(buffer);
    var b = new global.Int16Array(buffer);
    var c = new global.Int32Array(buffer);
    var d = new global.Uint8Array(buffer);
    var e = new global.Uint16Array(buffer);
    var f = new global.Uint32Array(buffer);
    var g = new global.Float32Array(buffer);
    var h = new global.Float64Array(buffer);
    var i = env.DYNAMICTOP_PTR | 0;
    var j = env.tempDoublePtr | 0;
    var k = env.ABORT | 0;
    var l = env.STACKTOP | 0;
    var m = env.STACK_MAX | 0;
    var n = 0;
    var o = 0;
    var p = 0;
    var q = 0;
    var r = global.NaN,
      s = global.Infinity;
    var t = 0,
      u = 0,
      v = 0,
      w = 0,
      x = 0.0;
    var y = 0;
    var z = global.Math.floor;
    var A = global.Math.abs;
    var B = global.Math.sqrt;
    var C = global.Math.pow;
    var D = global.Math.cos;
    var E = global.Math.sin;
    var F = global.Math.tan;
    var G = global.Math.acos;
    var H = global.Math.asin;
    var I = global.Math.atan;
    var J = global.Math.atan2;
    var K = global.Math.exp;
    var L = global.Math.log;
    var M = global.Math.ceil;
    var N = global.Math.imul;
    var O = global.Math.min;
    var P = global.Math.max;
    var Q = global.Math.clz32;
    var R = global.Math.fround;
    var S = env.abort;
    var T = env.assert;
    var U = env.enlargeMemory;
    var V = env.getTotalMemory;
    var W = env.abortOnCannotGrowMemory;
    var X = env.___setErrNo;
    var Y = env._emscripten_memcpy_big;
    var Z = R(0);
    const _ = R(0);
    // EMSCRIPTEN_START_FUNCS
    function $(a) {
      a = a | 0;
      var b = 0;
      b = l;
      l = (l + a) | 0;
      l = (l + 15) & -16;
      return b | 0;
    }
    function aa() {
      return l | 0;
    }
    function ba(a) {
      a = a | 0;
      l = a;
    }
    function ca(a, b) {
      a = a | 0;
      b = b | 0;
      l = a;
      m = b;
    }
    function da(a, b) {
      a = a | 0;
      b = b | 0;
      if (!n) {
        n = a;
        o = b;
      }
    }
    function ea(a) {
      a = a | 0;
      y = a;
    }
    function fa() {
      return y | 0;
    }
    function ga(a) {
      a = a | 0;
      var b = 0,
        d = 0,
        e = 0.0,
        f = 0,
        g = 0,
        i = 0,
        j = 0.0;
      if (a >>> 0 > 1) {
        b = 0;
        d = a;
        while (1) {
          b = (b + 1) | 0;
          if (d >>> 0 > 3) d = d >>> 1;
          else {
            d = b;
            break;
          }
        }
      } else d = 0;
      if (((1 << d) | 0) != (a | 0)) {
        a = 0;
        return a | 0;
      }
      i = a >>> 1;
      if (a >>> 0 > 1073741823) {
        a = 0;
        return a | 0;
      }
      b = ma(4) | 0;
      if (!b) {
        a = b;
        return a | 0;
      }
      c[(b + 8) >> 2] = d;
      d = i << 3;
      g = ma(d) | 0;
      c[b >> 2] = g;
      if (!g) {
        na(b);
        a = 0;
        return a | 0;
      }
      f = ma(d) | 0;
      c[(b + 4) >> 2] = f;
      if (!f) {
        na(g);
        na(b);
        a = 0;
        return a | 0;
      }
      if (!i) {
        a = b;
        return a | 0;
      }
      e = +(a >>> 0);
      d = 0;
      do {
        j = (+(d | 0) * 6.283185307179586) / e;
        h[(g + (d << 3)) >> 3] = +D(+j);
        h[(f + (d << 3)) >> 3] = +E(+j);
        d = (d + 1) | 0;
      } while ((d | 0) != (i | 0));
      return b | 0;
    }
    function ha(a) {
      a = a | 0;
      var b = 0,
        d = 0,
        e = 0.0,
        f = 0,
        h = 0,
        i = 0,
        j = 0.0;
      if (a >>> 0 > 1) {
        b = 0;
        d = a;
        while (1) {
          b = (b + 1) | 0;
          if (d >>> 0 > 3) d = d >>> 1;
          else {
            d = b;
            break;
          }
        }
      } else d = 0;
      if (((1 << d) | 0) != (a | 0)) {
        a = 0;
        return a | 0;
      }
      i = a >>> 1;
      if ((a | 0) < 0) {
        a = 0;
        return a | 0;
      }
      b = ma(12) | 0;
      if (!b) {
        a = b;
        return a | 0;
      }
      c[(b + 8) >> 2] = d;
      d = i << 2;
      h = ma(d) | 0;
      c[b >> 2] = h;
      if (!h) {
        na(b);
        a = 0;
        return a | 0;
      }
      f = ma(d) | 0;
      c[(b + 4) >> 2] = f;
      if (!f) {
        na(h);
        na(b);
        a = 0;
        return a | 0;
      }
      if (!i) {
        a = b;
        return a | 0;
      }
      e = +(a >>> 0);
      d = 0;
      do {
        j = (+(d | 0) * 6.283185307179586) / e;
        g[(h + (d << 2)) >> 2] = R(+D(+j));
        g[(f + (d << 2)) >> 2] = R(+E(+j));
        d = (d + 1) | 0;
      } while ((d | 0) != (i | 0));
      return b | 0;
    }
    function ia(a) {
      a = a | 0;
      if (!a) return;
      na(c[a >> 2] | 0);
      na(c[(a + 4) >> 2] | 0);
      na(a);
      return;
    }
    function ja(a) {
      a = a | 0;
      if (!a) return;
      na(c[a >> 2] | 0);
      na(c[(a + 4) >> 2] | 0);
      na(a);
      return;
    }
    function ka(a, b, d, e) {
      a = a | 0;
      b = b | 0;
      d = d | 0;
      e = e | 0;
      var f = 0,
        g = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0.0,
        q = 0,
        r = 0,
        s = 0.0,
        t = 0,
        u = 0.0,
        v = 0.0,
        w = 0.0;
      n = c[e >> 2] | 0;
      o = c[(e + 4) >> 2] | 0;
      if ((d | 0) <= 0) return;
      j = c[(e + 8) >> 2] | 0;
      if (!j) {
        e = 0;
        do e = (e + 1) | 0;
        while ((e | 0) != (d | 0));
      } else {
        f = 0;
        do {
          e = f;
          g = 0;
          i = 0;
          while (1) {
            i = (e & 1) | (i << 1);
            g = (g + 1) | 0;
            if ((g | 0) == (j | 0)) break;
            else e = e >>> 1;
          }
          if ((i | 0) > (f | 0)) {
            m = (a + (f << 3)) | 0;
            p = +h[m >> 3];
            l = (a + (i << 3)) | 0;
            h[m >> 3] = +h[l >> 3];
            h[l >> 3] = p;
            l = (b + (f << 3)) | 0;
            p = +h[l >> 3];
            m = (b + (i << 3)) | 0;
            h[l >> 3] = +h[m >> 3];
            h[m >> 3] = p;
          }
          f = (f + 1) | 0;
        } while ((f | 0) != (d | 0));
      }
      if ((d | 0) < 2) return;
      else e = 2;
      do {
        j = ((e | 0) / 2) | 0;
        k = ((d | 0) / (e | 0)) | 0;
        l = (e | 0) > 1;
        i = 0;
        do {
          m = (i + j) | 0;
          if (l) {
            f = 0;
            g = i;
            while (1) {
              t = (g + j) | 0;
              q = (a + (t << 3)) | 0;
              u = +h[q >> 3];
              w = +h[(n + (f << 3)) >> 3];
              t = (b + (t << 3)) | 0;
              v = +h[t >> 3];
              p = +h[(o + (f << 3)) >> 3];
              s = u * w + v * p;
              p = w * v - u * p;
              r = (a + (g << 3)) | 0;
              h[q >> 3] = +h[r >> 3] - s;
              q = (b + (g << 3)) | 0;
              h[t >> 3] = +h[q >> 3] - p;
              h[r >> 3] = s + +h[r >> 3];
              h[q >> 3] = p + +h[q >> 3];
              g = (g + 1) | 0;
              if ((g | 0) >= (m | 0)) break;
              else f = (f + k) | 0;
            }
          }
          i = (i + e) | 0;
        } while ((i | 0) < (d | 0));
        t = e;
        e = e << 1;
      } while (!(((t | 0) == (d | 0)) | ((e | 0) > (d | 0))));
      return;
    }
    function la(a, b, d, e) {
      a = a | 0;
      b = b | 0;
      d = d | 0;
      e = e | 0;
      var f = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = _,
        r = 0,
        s = _,
        t = 0,
        u = _,
        v = _,
        w = _;
      n = c[e >> 2] | 0;
      o = c[(e + 4) >> 2] | 0;
      if ((d | 0) <= 0) return;
      j = c[(e + 8) >> 2] | 0;
      if (!j) {
        e = 0;
        do e = (e + 1) | 0;
        while ((e | 0) != (d | 0));
      } else {
        f = 0;
        do {
          e = f;
          h = 0;
          i = 0;
          while (1) {
            i = (e & 1) | (i << 1);
            h = (h + 1) | 0;
            if ((h | 0) == (j | 0)) break;
            else e = e >>> 1;
          }
          if ((i | 0) > (f | 0)) {
            m = (a + (f << 2)) | 0;
            l = c[m >> 2] | 0;
            k = (a + (i << 2)) | 0;
            c[m >> 2] = c[k >> 2];
            c[k >> 2] = l;
            k = (b + (f << 2)) | 0;
            l = c[k >> 2] | 0;
            m = (b + (i << 2)) | 0;
            c[k >> 2] = c[m >> 2];
            c[m >> 2] = l;
          }
          f = (f + 1) | 0;
        } while ((f | 0) != (d | 0));
      }
      if ((d | 0) < 2) return;
      else e = 2;
      do {
        j = ((e | 0) / 2) | 0;
        k = ((d | 0) / (e | 0)) | 0;
        l = (e | 0) > 1;
        i = 0;
        do {
          m = (i + j) | 0;
          if (l) {
            f = 0;
            h = i;
            while (1) {
              t = (h + j) | 0;
              p = (a + (t << 2)) | 0;
              u = R(g[p >> 2]);
              w = R(g[(n + (f << 2)) >> 2]);
              s = R(u * w);
              t = (b + (t << 2)) | 0;
              v = R(g[t >> 2]);
              q = R(g[(o + (f << 2)) >> 2]);
              s = R(s + R(v * q));
              q = R(R(w * v) - R(u * q));
              r = (a + (h << 2)) | 0;
              g[p >> 2] = R(R(g[r >> 2]) - s);
              p = (b + (h << 2)) | 0;
              g[t >> 2] = R(R(g[p >> 2]) - q);
              g[r >> 2] = R(s + R(g[r >> 2]));
              g[p >> 2] = R(q + R(g[p >> 2]));
              h = (h + 1) | 0;
              if ((h | 0) >= (m | 0)) break;
              else f = (f + k) | 0;
            }
          }
          i = (i + e) | 0;
        } while ((i | 0) < (d | 0));
        t = e;
        e = e << 1;
      } while (!(((t | 0) == (d | 0)) | ((e | 0) > (d | 0))));
      return;
    }
    function ma(a) {
      a = a | 0;
      var b = 0,
        d = 0,
        e = 0,
        f = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0,
        s = 0,
        t = 0,
        u = 0,
        v = 0,
        w = 0,
        x = 0;
      x = l;
      l = (l + 16) | 0;
      o = x;
      do
        if (a >>> 0 < 245) {
          k = a >>> 0 < 11 ? 16 : (a + 11) & -8;
          a = k >>> 3;
          n = c[63] | 0;
          d = n >>> a;
          if ((d & 3) | 0) {
            b = (((d & 1) ^ 1) + a) | 0;
            a = (292 + ((b << 1) << 2)) | 0;
            d = (a + 8) | 0;
            e = c[d >> 2] | 0;
            f = (e + 8) | 0;
            g = c[f >> 2] | 0;
            if ((a | 0) == (g | 0)) c[63] = n & ~(1 << b);
            else {
              c[(g + 12) >> 2] = a;
              c[d >> 2] = g;
            }
            w = b << 3;
            c[(e + 4) >> 2] = w | 3;
            w = (e + w + 4) | 0;
            c[w >> 2] = c[w >> 2] | 1;
            w = f;
            l = x;
            return w | 0;
          }
          m = c[65] | 0;
          if (k >>> 0 > m >>> 0) {
            if (d | 0) {
              b = 2 << a;
              b = (d << a) & (b | (0 - b));
              b = ((b & (0 - b)) + -1) | 0;
              h = (b >>> 12) & 16;
              b = b >>> h;
              d = (b >>> 5) & 8;
              b = b >>> d;
              f = (b >>> 2) & 4;
              b = b >>> f;
              a = (b >>> 1) & 2;
              b = b >>> a;
              e = (b >>> 1) & 1;
              e = ((d | h | f | a | e) + (b >>> e)) | 0;
              b = (292 + ((e << 1) << 2)) | 0;
              a = (b + 8) | 0;
              f = c[a >> 2] | 0;
              h = (f + 8) | 0;
              d = c[h >> 2] | 0;
              if ((b | 0) == (d | 0)) {
                a = n & ~(1 << e);
                c[63] = a;
              } else {
                c[(d + 12) >> 2] = b;
                c[a >> 2] = d;
                a = n;
              }
              g = ((e << 3) - k) | 0;
              c[(f + 4) >> 2] = k | 3;
              e = (f + k) | 0;
              c[(e + 4) >> 2] = g | 1;
              c[(e + g) >> 2] = g;
              if (m | 0) {
                f = c[68] | 0;
                b = m >>> 3;
                d = (292 + ((b << 1) << 2)) | 0;
                b = 1 << b;
                if (!(a & b)) {
                  c[63] = a | b;
                  b = d;
                  a = (d + 8) | 0;
                } else {
                  a = (d + 8) | 0;
                  b = c[a >> 2] | 0;
                }
                c[a >> 2] = f;
                c[(b + 12) >> 2] = f;
                c[(f + 8) >> 2] = b;
                c[(f + 12) >> 2] = d;
              }
              c[65] = g;
              c[68] = e;
              w = h;
              l = x;
              return w | 0;
            }
            i = c[64] | 0;
            if (i) {
              d = ((i & (0 - i)) + -1) | 0;
              h = (d >>> 12) & 16;
              d = d >>> h;
              g = (d >>> 5) & 8;
              d = d >>> g;
              j = (d >>> 2) & 4;
              d = d >>> j;
              e = (d >>> 1) & 2;
              d = d >>> e;
              a = (d >>> 1) & 1;
              a = c[(556 + (((g | h | j | e | a) + (d >>> a)) << 2)) >> 2] | 0;
              d = ((c[(a + 4) >> 2] & -8) - k) | 0;
              e = c[(a + 16 + ((((c[(a + 16) >> 2] | 0) == 0) & 1) << 2)) >> 2] | 0;
              if (!e) {
                j = a;
                g = d;
              } else {
                do {
                  h = ((c[(e + 4) >> 2] & -8) - k) | 0;
                  j = h >>> 0 < d >>> 0;
                  d = j ? h : d;
                  a = j ? e : a;
                  e = c[(e + 16 + ((((c[(e + 16) >> 2] | 0) == 0) & 1) << 2)) >> 2] | 0;
                } while ((e | 0) != 0);
                j = a;
                g = d;
              }
              h = (j + k) | 0;
              if (j >>> 0 < h >>> 0) {
                f = c[(j + 24) >> 2] | 0;
                b = c[(j + 12) >> 2] | 0;
                do
                  if ((b | 0) == (j | 0)) {
                    a = (j + 20) | 0;
                    b = c[a >> 2] | 0;
                    if (!b) {
                      a = (j + 16) | 0;
                      b = c[a >> 2] | 0;
                      if (!b) {
                        d = 0;
                        break;
                      }
                    }
                    while (1) {
                      d = (b + 20) | 0;
                      e = c[d >> 2] | 0;
                      if (e | 0) {
                        b = e;
                        a = d;
                        continue;
                      }
                      d = (b + 16) | 0;
                      e = c[d >> 2] | 0;
                      if (!e) break;
                      else {
                        b = e;
                        a = d;
                      }
                    }
                    c[a >> 2] = 0;
                    d = b;
                  } else {
                    d = c[(j + 8) >> 2] | 0;
                    c[(d + 12) >> 2] = b;
                    c[(b + 8) >> 2] = d;
                    d = b;
                  }
                while (0);
                do
                  if (f | 0) {
                    b = c[(j + 28) >> 2] | 0;
                    a = (556 + (b << 2)) | 0;
                    if ((j | 0) == (c[a >> 2] | 0)) {
                      c[a >> 2] = d;
                      if (!d) {
                        c[64] = i & ~(1 << b);
                        break;
                      }
                    } else {
                      c[(f + 16 + ((((c[(f + 16) >> 2] | 0) != (j | 0)) & 1) << 2)) >> 2] = d;
                      if (!d) break;
                    }
                    c[(d + 24) >> 2] = f;
                    b = c[(j + 16) >> 2] | 0;
                    if (b | 0) {
                      c[(d + 16) >> 2] = b;
                      c[(b + 24) >> 2] = d;
                    }
                    b = c[(j + 20) >> 2] | 0;
                    if (b | 0) {
                      c[(d + 20) >> 2] = b;
                      c[(b + 24) >> 2] = d;
                    }
                  }
                while (0);
                if (g >>> 0 < 16) {
                  w = (g + k) | 0;
                  c[(j + 4) >> 2] = w | 3;
                  w = (j + w + 4) | 0;
                  c[w >> 2] = c[w >> 2] | 1;
                } else {
                  c[(j + 4) >> 2] = k | 3;
                  c[(h + 4) >> 2] = g | 1;
                  c[(h + g) >> 2] = g;
                  if (m | 0) {
                    e = c[68] | 0;
                    b = m >>> 3;
                    d = (292 + ((b << 1) << 2)) | 0;
                    b = 1 << b;
                    if (!(n & b)) {
                      c[63] = n | b;
                      b = d;
                      a = (d + 8) | 0;
                    } else {
                      a = (d + 8) | 0;
                      b = c[a >> 2] | 0;
                    }
                    c[a >> 2] = e;
                    c[(b + 12) >> 2] = e;
                    c[(e + 8) >> 2] = b;
                    c[(e + 12) >> 2] = d;
                  }
                  c[65] = g;
                  c[68] = h;
                }
                w = (j + 8) | 0;
                l = x;
                return w | 0;
              } else n = k;
            } else n = k;
          } else n = k;
        } else if (a >>> 0 <= 4294967231) {
          a = (a + 11) | 0;
          k = a & -8;
          j = c[64] | 0;
          if (j) {
            e = (0 - k) | 0;
            a = a >>> 8;
            if (a)
              if (k >>> 0 > 16777215) i = 31;
              else {
                n = (((a + 1048320) | 0) >>> 16) & 8;
                v = a << n;
                m = (((v + 520192) | 0) >>> 16) & 4;
                v = v << m;
                i = (((v + 245760) | 0) >>> 16) & 2;
                i = (14 - (m | n | i) + ((v << i) >>> 15)) | 0;
                i = ((k >>> ((i + 7) | 0)) & 1) | (i << 1);
              }
            else i = 0;
            d = c[(556 + (i << 2)) >> 2] | 0;
            a: do
              if (!d) {
                d = 0;
                a = 0;
                v = 57;
              } else {
                a = 0;
                h = k << ((i | 0) == 31 ? 0 : (25 - (i >>> 1)) | 0);
                g = 0;
                while (1) {
                  f = ((c[(d + 4) >> 2] & -8) - k) | 0;
                  if (f >>> 0 < e >>> 0)
                    if (!f) {
                      a = d;
                      e = 0;
                      f = d;
                      v = 61;
                      break a;
                    } else {
                      a = d;
                      e = f;
                    }
                  f = c[(d + 20) >> 2] | 0;
                  d = c[(d + 16 + ((h >>> 31) << 2)) >> 2] | 0;
                  g = ((f | 0) == 0) | ((f | 0) == (d | 0)) ? g : f;
                  f = (d | 0) == 0;
                  if (f) {
                    d = g;
                    v = 57;
                    break;
                  } else h = h << ((f ^ 1) & 1);
                }
              }
            while (0);
            if ((v | 0) == 57) {
              if (((d | 0) == 0) & ((a | 0) == 0)) {
                a = 2 << i;
                a = j & (a | (0 - a));
                if (!a) {
                  n = k;
                  break;
                }
                n = ((a & (0 - a)) + -1) | 0;
                h = (n >>> 12) & 16;
                n = n >>> h;
                g = (n >>> 5) & 8;
                n = n >>> g;
                i = (n >>> 2) & 4;
                n = n >>> i;
                m = (n >>> 1) & 2;
                n = n >>> m;
                d = (n >>> 1) & 1;
                a = 0;
                d = c[(556 + (((g | h | i | m | d) + (n >>> d)) << 2)) >> 2] | 0;
              }
              if (!d) {
                i = a;
                h = e;
              } else {
                f = d;
                v = 61;
              }
            }
            if ((v | 0) == 61)
              while (1) {
                v = 0;
                d = ((c[(f + 4) >> 2] & -8) - k) | 0;
                n = d >>> 0 < e >>> 0;
                d = n ? d : e;
                a = n ? f : a;
                f = c[(f + 16 + ((((c[(f + 16) >> 2] | 0) == 0) & 1) << 2)) >> 2] | 0;
                if (!f) {
                  i = a;
                  h = d;
                  break;
                } else {
                  e = d;
                  v = 61;
                }
              }
            if ((i | 0) != 0 ? h >>> 0 < (((c[65] | 0) - k) | 0) >>> 0 : 0) {
              g = (i + k) | 0;
              if (i >>> 0 >= g >>> 0) {
                w = 0;
                l = x;
                return w | 0;
              }
              f = c[(i + 24) >> 2] | 0;
              b = c[(i + 12) >> 2] | 0;
              do
                if ((b | 0) == (i | 0)) {
                  a = (i + 20) | 0;
                  b = c[a >> 2] | 0;
                  if (!b) {
                    a = (i + 16) | 0;
                    b = c[a >> 2] | 0;
                    if (!b) {
                      b = 0;
                      break;
                    }
                  }
                  while (1) {
                    d = (b + 20) | 0;
                    e = c[d >> 2] | 0;
                    if (e | 0) {
                      b = e;
                      a = d;
                      continue;
                    }
                    d = (b + 16) | 0;
                    e = c[d >> 2] | 0;
                    if (!e) break;
                    else {
                      b = e;
                      a = d;
                    }
                  }
                  c[a >> 2] = 0;
                } else {
                  w = c[(i + 8) >> 2] | 0;
                  c[(w + 12) >> 2] = b;
                  c[(b + 8) >> 2] = w;
                }
              while (0);
              do
                if (f) {
                  a = c[(i + 28) >> 2] | 0;
                  d = (556 + (a << 2)) | 0;
                  if ((i | 0) == (c[d >> 2] | 0)) {
                    c[d >> 2] = b;
                    if (!b) {
                      e = j & ~(1 << a);
                      c[64] = e;
                      break;
                    }
                  } else {
                    c[(f + 16 + ((((c[(f + 16) >> 2] | 0) != (i | 0)) & 1) << 2)) >> 2] = b;
                    if (!b) {
                      e = j;
                      break;
                    }
                  }
                  c[(b + 24) >> 2] = f;
                  a = c[(i + 16) >> 2] | 0;
                  if (a | 0) {
                    c[(b + 16) >> 2] = a;
                    c[(a + 24) >> 2] = b;
                  }
                  a = c[(i + 20) >> 2] | 0;
                  if (a) {
                    c[(b + 20) >> 2] = a;
                    c[(a + 24) >> 2] = b;
                    e = j;
                  } else e = j;
                } else e = j;
              while (0);
              do
                if (h >>> 0 >= 16) {
                  c[(i + 4) >> 2] = k | 3;
                  c[(g + 4) >> 2] = h | 1;
                  c[(g + h) >> 2] = h;
                  b = h >>> 3;
                  if (h >>> 0 < 256) {
                    d = (292 + ((b << 1) << 2)) | 0;
                    a = c[63] | 0;
                    b = 1 << b;
                    if (!(a & b)) {
                      c[63] = a | b;
                      b = d;
                      a = (d + 8) | 0;
                    } else {
                      a = (d + 8) | 0;
                      b = c[a >> 2] | 0;
                    }
                    c[a >> 2] = g;
                    c[(b + 12) >> 2] = g;
                    c[(g + 8) >> 2] = b;
                    c[(g + 12) >> 2] = d;
                    break;
                  }
                  b = h >>> 8;
                  if (b)
                    if (h >>> 0 > 16777215) b = 31;
                    else {
                      v = (((b + 1048320) | 0) >>> 16) & 8;
                      w = b << v;
                      u = (((w + 520192) | 0) >>> 16) & 4;
                      w = w << u;
                      b = (((w + 245760) | 0) >>> 16) & 2;
                      b = (14 - (u | v | b) + ((w << b) >>> 15)) | 0;
                      b = ((h >>> ((b + 7) | 0)) & 1) | (b << 1);
                    }
                  else b = 0;
                  d = (556 + (b << 2)) | 0;
                  c[(g + 28) >> 2] = b;
                  a = (g + 16) | 0;
                  c[(a + 4) >> 2] = 0;
                  c[a >> 2] = 0;
                  a = 1 << b;
                  if (!(e & a)) {
                    c[64] = e | a;
                    c[d >> 2] = g;
                    c[(g + 24) >> 2] = d;
                    c[(g + 12) >> 2] = g;
                    c[(g + 8) >> 2] = g;
                    break;
                  }
                  a = h << ((b | 0) == 31 ? 0 : (25 - (b >>> 1)) | 0);
                  d = c[d >> 2] | 0;
                  while (1) {
                    if (((c[(d + 4) >> 2] & -8) | 0) == (h | 0)) {
                      v = 97;
                      break;
                    }
                    e = (d + 16 + ((a >>> 31) << 2)) | 0;
                    b = c[e >> 2] | 0;
                    if (!b) {
                      v = 96;
                      break;
                    } else {
                      a = a << 1;
                      d = b;
                    }
                  }
                  if ((v | 0) == 96) {
                    c[e >> 2] = g;
                    c[(g + 24) >> 2] = d;
                    c[(g + 12) >> 2] = g;
                    c[(g + 8) >> 2] = g;
                    break;
                  } else if ((v | 0) == 97) {
                    v = (d + 8) | 0;
                    w = c[v >> 2] | 0;
                    c[(w + 12) >> 2] = g;
                    c[v >> 2] = g;
                    c[(g + 8) >> 2] = w;
                    c[(g + 12) >> 2] = d;
                    c[(g + 24) >> 2] = 0;
                    break;
                  }
                } else {
                  w = (h + k) | 0;
                  c[(i + 4) >> 2] = w | 3;
                  w = (i + w + 4) | 0;
                  c[w >> 2] = c[w >> 2] | 1;
                }
              while (0);
              w = (i + 8) | 0;
              l = x;
              return w | 0;
            } else n = k;
          } else n = k;
        } else n = -1;
      while (0);
      d = c[65] | 0;
      if (d >>> 0 >= n >>> 0) {
        b = (d - n) | 0;
        a = c[68] | 0;
        if (b >>> 0 > 15) {
          w = (a + n) | 0;
          c[68] = w;
          c[65] = b;
          c[(w + 4) >> 2] = b | 1;
          c[(w + b) >> 2] = b;
          c[(a + 4) >> 2] = n | 3;
        } else {
          c[65] = 0;
          c[68] = 0;
          c[(a + 4) >> 2] = d | 3;
          w = (a + d + 4) | 0;
          c[w >> 2] = c[w >> 2] | 1;
        }
        w = (a + 8) | 0;
        l = x;
        return w | 0;
      }
      h = c[66] | 0;
      if (h >>> 0 > n >>> 0) {
        u = (h - n) | 0;
        c[66] = u;
        w = c[69] | 0;
        v = (w + n) | 0;
        c[69] = v;
        c[(v + 4) >> 2] = u | 1;
        c[(w + 4) >> 2] = n | 3;
        w = (w + 8) | 0;
        l = x;
        return w | 0;
      }
      if (!(c[181] | 0)) {
        c[183] = 4096;
        c[182] = 4096;
        c[184] = -1;
        c[185] = -1;
        c[186] = 0;
        c[174] = 0;
        a = (o & -16) ^ 1431655768;
        c[o >> 2] = a;
        c[181] = a;
        a = 4096;
      } else a = c[183] | 0;
      i = (n + 48) | 0;
      j = (n + 47) | 0;
      g = (a + j) | 0;
      f = (0 - a) | 0;
      k = g & f;
      if (k >>> 0 <= n >>> 0) {
        w = 0;
        l = x;
        return w | 0;
      }
      a = c[173] | 0;
      if (a | 0 ? ((m = c[171] | 0), (o = (m + k) | 0), (o >>> 0 <= m >>> 0) | (o >>> 0 > a >>> 0)) : 0) {
        w = 0;
        l = x;
        return w | 0;
      }
      b: do
        if (!(c[174] & 4)) {
          d = c[69] | 0;
          c: do
            if (d) {
              e = 700;
              while (1) {
                a = c[e >> 2] | 0;
                if (a >>> 0 <= d >>> 0 ? ((r = (e + 4) | 0), ((a + (c[r >> 2] | 0)) | 0) >>> 0 > d >>> 0) : 0) break;
                a = c[(e + 8) >> 2] | 0;
                if (!a) {
                  v = 118;
                  break c;
                } else e = a;
              }
              b = (g - h) & f;
              if (b >>> 0 < 2147483647) {
                a = ta(b | 0) | 0;
                if ((a | 0) == (((c[e >> 2] | 0) + (c[r >> 2] | 0)) | 0)) {
                  if ((a | 0) != (-1 | 0)) {
                    h = b;
                    g = a;
                    v = 135;
                    break b;
                  }
                } else {
                  e = a;
                  v = 126;
                }
              } else b = 0;
            } else v = 118;
          while (0);
          do
            if ((v | 0) == 118) {
              d = ta(0) | 0;
              if (
                (d | 0) != (-1 | 0)
                  ? ((b = d),
                    (p = c[182] | 0),
                    (q = (p + -1) | 0),
                    (b = ((((q & b) | 0) == 0 ? 0 : (((q + b) & (0 - p)) - b) | 0) + k) | 0),
                    (p = c[171] | 0),
                    (q = (b + p) | 0),
                    (b >>> 0 > n >>> 0) & (b >>> 0 < 2147483647))
                  : 0
              ) {
                r = c[173] | 0;
                if (r | 0 ? (q >>> 0 <= p >>> 0) | (q >>> 0 > r >>> 0) : 0) {
                  b = 0;
                  break;
                }
                a = ta(b | 0) | 0;
                if ((a | 0) == (d | 0)) {
                  h = b;
                  g = d;
                  v = 135;
                  break b;
                } else {
                  e = a;
                  v = 126;
                }
              } else b = 0;
            }
          while (0);
          do
            if ((v | 0) == 126) {
              d = (0 - b) | 0;
              if (!((i >>> 0 > b >>> 0) & ((b >>> 0 < 2147483647) & ((e | 0) != (-1 | 0)))))
                if ((e | 0) == (-1 | 0)) {
                  b = 0;
                  break;
                } else {
                  h = b;
                  g = e;
                  v = 135;
                  break b;
                }
              a = c[183] | 0;
              a = (j - b + a) & (0 - a);
              if (a >>> 0 >= 2147483647) {
                h = b;
                g = e;
                v = 135;
                break b;
              }
              if ((ta(a | 0) | 0) == (-1 | 0)) {
                ta(d | 0) | 0;
                b = 0;
                break;
              } else {
                h = (a + b) | 0;
                g = e;
                v = 135;
                break b;
              }
            }
          while (0);
          c[174] = c[174] | 4;
          v = 133;
        } else {
          b = 0;
          v = 133;
        }
      while (0);
      if (
        ((v | 0) == 133 ? k >>> 0 < 2147483647 : 0)
          ? ((u = ta(k | 0) | 0),
            (r = ta(0) | 0),
            (s = (r - u) | 0),
            (t = s >>> 0 > ((n + 40) | 0) >>> 0),
            !(
              ((u | 0) == (-1 | 0)) |
              (t ^ 1) |
              (((u >>> 0 < r >>> 0) & (((u | 0) != (-1 | 0)) & ((r | 0) != (-1 | 0)))) ^ 1)
            ))
          : 0
      ) {
        h = t ? s : b;
        g = u;
        v = 135;
      }
      if ((v | 0) == 135) {
        b = ((c[171] | 0) + h) | 0;
        c[171] = b;
        if (b >>> 0 > (c[172] | 0) >>> 0) c[172] = b;
        j = c[69] | 0;
        do
          if (j) {
            b = 700;
            while (1) {
              a = c[b >> 2] | 0;
              d = (b + 4) | 0;
              e = c[d >> 2] | 0;
              if ((g | 0) == ((a + e) | 0)) {
                v = 145;
                break;
              }
              f = c[(b + 8) >> 2] | 0;
              if (!f) break;
              else b = f;
            }
            if (
              ((v | 0) == 145 ? ((c[(b + 12) >> 2] & 8) | 0) == 0 : 0) ? (j >>> 0 < g >>> 0) & (j >>> 0 >= a >>> 0) : 0
            ) {
              c[d >> 2] = e + h;
              w = (j + 8) | 0;
              w = ((w & 7) | 0) == 0 ? 0 : (0 - w) & 7;
              v = (j + w) | 0;
              w = ((c[66] | 0) + (h - w)) | 0;
              c[69] = v;
              c[66] = w;
              c[(v + 4) >> 2] = w | 1;
              c[(v + w + 4) >> 2] = 40;
              c[70] = c[185];
              break;
            }
            if (g >>> 0 < (c[67] | 0) >>> 0) c[67] = g;
            d = (g + h) | 0;
            b = 700;
            while (1) {
              if ((c[b >> 2] | 0) == (d | 0)) {
                v = 153;
                break;
              }
              a = c[(b + 8) >> 2] | 0;
              if (!a) break;
              else b = a;
            }
            if ((v | 0) == 153 ? ((c[(b + 12) >> 2] & 8) | 0) == 0 : 0) {
              c[b >> 2] = g;
              m = (b + 4) | 0;
              c[m >> 2] = (c[m >> 2] | 0) + h;
              m = (g + 8) | 0;
              m = (g + (((m & 7) | 0) == 0 ? 0 : (0 - m) & 7)) | 0;
              b = (d + 8) | 0;
              b = (d + (((b & 7) | 0) == 0 ? 0 : (0 - b) & 7)) | 0;
              k = (m + n) | 0;
              i = (b - m - n) | 0;
              c[(m + 4) >> 2] = n | 3;
              do
                if ((b | 0) != (j | 0)) {
                  if ((b | 0) == (c[68] | 0)) {
                    w = ((c[65] | 0) + i) | 0;
                    c[65] = w;
                    c[68] = k;
                    c[(k + 4) >> 2] = w | 1;
                    c[(k + w) >> 2] = w;
                    break;
                  }
                  a = c[(b + 4) >> 2] | 0;
                  if (((a & 3) | 0) == 1) {
                    h = a & -8;
                    e = a >>> 3;
                    d: do
                      if (a >>> 0 < 256) {
                        a = c[(b + 8) >> 2] | 0;
                        d = c[(b + 12) >> 2] | 0;
                        if ((d | 0) == (a | 0)) {
                          c[63] = c[63] & ~(1 << e);
                          break;
                        } else {
                          c[(a + 12) >> 2] = d;
                          c[(d + 8) >> 2] = a;
                          break;
                        }
                      } else {
                        g = c[(b + 24) >> 2] | 0;
                        a = c[(b + 12) >> 2] | 0;
                        do
                          if ((a | 0) == (b | 0)) {
                            e = (b + 16) | 0;
                            d = (e + 4) | 0;
                            a = c[d >> 2] | 0;
                            if (!a) {
                              a = c[e >> 2] | 0;
                              if (!a) {
                                a = 0;
                                break;
                              } else d = e;
                            }
                            while (1) {
                              e = (a + 20) | 0;
                              f = c[e >> 2] | 0;
                              if (f | 0) {
                                a = f;
                                d = e;
                                continue;
                              }
                              e = (a + 16) | 0;
                              f = c[e >> 2] | 0;
                              if (!f) break;
                              else {
                                a = f;
                                d = e;
                              }
                            }
                            c[d >> 2] = 0;
                          } else {
                            w = c[(b + 8) >> 2] | 0;
                            c[(w + 12) >> 2] = a;
                            c[(a + 8) >> 2] = w;
                          }
                        while (0);
                        if (!g) break;
                        d = c[(b + 28) >> 2] | 0;
                        e = (556 + (d << 2)) | 0;
                        do
                          if ((b | 0) != (c[e >> 2] | 0)) {
                            c[(g + 16 + ((((c[(g + 16) >> 2] | 0) != (b | 0)) & 1) << 2)) >> 2] = a;
                            if (!a) break d;
                          } else {
                            c[e >> 2] = a;
                            if (a | 0) break;
                            c[64] = c[64] & ~(1 << d);
                            break d;
                          }
                        while (0);
                        c[(a + 24) >> 2] = g;
                        d = (b + 16) | 0;
                        e = c[d >> 2] | 0;
                        if (e | 0) {
                          c[(a + 16) >> 2] = e;
                          c[(e + 24) >> 2] = a;
                        }
                        d = c[(d + 4) >> 2] | 0;
                        if (!d) break;
                        c[(a + 20) >> 2] = d;
                        c[(d + 24) >> 2] = a;
                      }
                    while (0);
                    b = (b + h) | 0;
                    f = (h + i) | 0;
                  } else f = i;
                  b = (b + 4) | 0;
                  c[b >> 2] = c[b >> 2] & -2;
                  c[(k + 4) >> 2] = f | 1;
                  c[(k + f) >> 2] = f;
                  b = f >>> 3;
                  if (f >>> 0 < 256) {
                    d = (292 + ((b << 1) << 2)) | 0;
                    a = c[63] | 0;
                    b = 1 << b;
                    if (!(a & b)) {
                      c[63] = a | b;
                      b = d;
                      a = (d + 8) | 0;
                    } else {
                      a = (d + 8) | 0;
                      b = c[a >> 2] | 0;
                    }
                    c[a >> 2] = k;
                    c[(b + 12) >> 2] = k;
                    c[(k + 8) >> 2] = b;
                    c[(k + 12) >> 2] = d;
                    break;
                  }
                  b = f >>> 8;
                  do
                    if (!b) b = 0;
                    else {
                      if (f >>> 0 > 16777215) {
                        b = 31;
                        break;
                      }
                      v = (((b + 1048320) | 0) >>> 16) & 8;
                      w = b << v;
                      u = (((w + 520192) | 0) >>> 16) & 4;
                      w = w << u;
                      b = (((w + 245760) | 0) >>> 16) & 2;
                      b = (14 - (u | v | b) + ((w << b) >>> 15)) | 0;
                      b = ((f >>> ((b + 7) | 0)) & 1) | (b << 1);
                    }
                  while (0);
                  e = (556 + (b << 2)) | 0;
                  c[(k + 28) >> 2] = b;
                  a = (k + 16) | 0;
                  c[(a + 4) >> 2] = 0;
                  c[a >> 2] = 0;
                  a = c[64] | 0;
                  d = 1 << b;
                  if (!(a & d)) {
                    c[64] = a | d;
                    c[e >> 2] = k;
                    c[(k + 24) >> 2] = e;
                    c[(k + 12) >> 2] = k;
                    c[(k + 8) >> 2] = k;
                    break;
                  }
                  a = f << ((b | 0) == 31 ? 0 : (25 - (b >>> 1)) | 0);
                  d = c[e >> 2] | 0;
                  while (1) {
                    if (((c[(d + 4) >> 2] & -8) | 0) == (f | 0)) {
                      v = 194;
                      break;
                    }
                    e = (d + 16 + ((a >>> 31) << 2)) | 0;
                    b = c[e >> 2] | 0;
                    if (!b) {
                      v = 193;
                      break;
                    } else {
                      a = a << 1;
                      d = b;
                    }
                  }
                  if ((v | 0) == 193) {
                    c[e >> 2] = k;
                    c[(k + 24) >> 2] = d;
                    c[(k + 12) >> 2] = k;
                    c[(k + 8) >> 2] = k;
                    break;
                  } else if ((v | 0) == 194) {
                    v = (d + 8) | 0;
                    w = c[v >> 2] | 0;
                    c[(w + 12) >> 2] = k;
                    c[v >> 2] = k;
                    c[(k + 8) >> 2] = w;
                    c[(k + 12) >> 2] = d;
                    c[(k + 24) >> 2] = 0;
                    break;
                  }
                } else {
                  w = ((c[66] | 0) + i) | 0;
                  c[66] = w;
                  c[69] = k;
                  c[(k + 4) >> 2] = w | 1;
                }
              while (0);
              w = (m + 8) | 0;
              l = x;
              return w | 0;
            }
            b = 700;
            while (1) {
              a = c[b >> 2] | 0;
              if (a >>> 0 <= j >>> 0 ? ((w = (a + (c[(b + 4) >> 2] | 0)) | 0), w >>> 0 > j >>> 0) : 0) break;
              b = c[(b + 8) >> 2] | 0;
            }
            f = (w + -47) | 0;
            a = (f + 8) | 0;
            a = (f + (((a & 7) | 0) == 0 ? 0 : (0 - a) & 7)) | 0;
            f = (j + 16) | 0;
            a = a >>> 0 < f >>> 0 ? j : a;
            b = (a + 8) | 0;
            d = (g + 8) | 0;
            d = ((d & 7) | 0) == 0 ? 0 : (0 - d) & 7;
            v = (g + d) | 0;
            d = (h + -40 - d) | 0;
            c[69] = v;
            c[66] = d;
            c[(v + 4) >> 2] = d | 1;
            c[(v + d + 4) >> 2] = 40;
            c[70] = c[185];
            d = (a + 4) | 0;
            c[d >> 2] = 27;
            c[b >> 2] = c[175];
            c[(b + 4) >> 2] = c[176];
            c[(b + 8) >> 2] = c[177];
            c[(b + 12) >> 2] = c[178];
            c[175] = g;
            c[176] = h;
            c[178] = 0;
            c[177] = b;
            b = (a + 24) | 0;
            do {
              v = b;
              b = (b + 4) | 0;
              c[b >> 2] = 7;
            } while (((v + 8) | 0) >>> 0 < w >>> 0);
            if ((a | 0) != (j | 0)) {
              g = (a - j) | 0;
              c[d >> 2] = c[d >> 2] & -2;
              c[(j + 4) >> 2] = g | 1;
              c[a >> 2] = g;
              b = g >>> 3;
              if (g >>> 0 < 256) {
                d = (292 + ((b << 1) << 2)) | 0;
                a = c[63] | 0;
                b = 1 << b;
                if (!(a & b)) {
                  c[63] = a | b;
                  b = d;
                  a = (d + 8) | 0;
                } else {
                  a = (d + 8) | 0;
                  b = c[a >> 2] | 0;
                }
                c[a >> 2] = j;
                c[(b + 12) >> 2] = j;
                c[(j + 8) >> 2] = b;
                c[(j + 12) >> 2] = d;
                break;
              }
              b = g >>> 8;
              if (b)
                if (g >>> 0 > 16777215) d = 31;
                else {
                  v = (((b + 1048320) | 0) >>> 16) & 8;
                  w = b << v;
                  u = (((w + 520192) | 0) >>> 16) & 4;
                  w = w << u;
                  d = (((w + 245760) | 0) >>> 16) & 2;
                  d = (14 - (u | v | d) + ((w << d) >>> 15)) | 0;
                  d = ((g >>> ((d + 7) | 0)) & 1) | (d << 1);
                }
              else d = 0;
              e = (556 + (d << 2)) | 0;
              c[(j + 28) >> 2] = d;
              c[(j + 20) >> 2] = 0;
              c[f >> 2] = 0;
              b = c[64] | 0;
              a = 1 << d;
              if (!(b & a)) {
                c[64] = b | a;
                c[e >> 2] = j;
                c[(j + 24) >> 2] = e;
                c[(j + 12) >> 2] = j;
                c[(j + 8) >> 2] = j;
                break;
              }
              a = g << ((d | 0) == 31 ? 0 : (25 - (d >>> 1)) | 0);
              d = c[e >> 2] | 0;
              while (1) {
                if (((c[(d + 4) >> 2] & -8) | 0) == (g | 0)) {
                  v = 216;
                  break;
                }
                e = (d + 16 + ((a >>> 31) << 2)) | 0;
                b = c[e >> 2] | 0;
                if (!b) {
                  v = 215;
                  break;
                } else {
                  a = a << 1;
                  d = b;
                }
              }
              if ((v | 0) == 215) {
                c[e >> 2] = j;
                c[(j + 24) >> 2] = d;
                c[(j + 12) >> 2] = j;
                c[(j + 8) >> 2] = j;
                break;
              } else if ((v | 0) == 216) {
                v = (d + 8) | 0;
                w = c[v >> 2] | 0;
                c[(w + 12) >> 2] = j;
                c[v >> 2] = j;
                c[(j + 8) >> 2] = w;
                c[(j + 12) >> 2] = d;
                c[(j + 24) >> 2] = 0;
                break;
              }
            }
          } else {
            w = c[67] | 0;
            if (((w | 0) == 0) | (g >>> 0 < w >>> 0)) c[67] = g;
            c[175] = g;
            c[176] = h;
            c[178] = 0;
            c[72] = c[181];
            c[71] = -1;
            b = 0;
            do {
              w = (292 + ((b << 1) << 2)) | 0;
              c[(w + 12) >> 2] = w;
              c[(w + 8) >> 2] = w;
              b = (b + 1) | 0;
            } while ((b | 0) != 32);
            w = (g + 8) | 0;
            w = ((w & 7) | 0) == 0 ? 0 : (0 - w) & 7;
            v = (g + w) | 0;
            w = (h + -40 - w) | 0;
            c[69] = v;
            c[66] = w;
            c[(v + 4) >> 2] = w | 1;
            c[(v + w + 4) >> 2] = 40;
            c[70] = c[185];
          }
        while (0);
        b = c[66] | 0;
        if (b >>> 0 > n >>> 0) {
          u = (b - n) | 0;
          c[66] = u;
          w = c[69] | 0;
          v = (w + n) | 0;
          c[69] = v;
          c[(v + 4) >> 2] = u | 1;
          c[(w + 4) >> 2] = n | 3;
          w = (w + 8) | 0;
          l = x;
          return w | 0;
        }
      }
      c[(oa() | 0) >> 2] = 12;
      w = 0;
      l = x;
      return w | 0;
    }
    function na(a) {
      a = a | 0;
      var b = 0,
        d = 0,
        e = 0,
        f = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0;
      if (!a) return;
      d = (a + -8) | 0;
      f = c[67] | 0;
      a = c[(a + -4) >> 2] | 0;
      b = a & -8;
      j = (d + b) | 0;
      do
        if (!(a & 1)) {
          e = c[d >> 2] | 0;
          if (!(a & 3)) return;
          h = (d + (0 - e)) | 0;
          g = (e + b) | 0;
          if (h >>> 0 < f >>> 0) return;
          if ((h | 0) == (c[68] | 0)) {
            a = (j + 4) | 0;
            b = c[a >> 2] | 0;
            if (((b & 3) | 0) != 3) {
              i = h;
              b = g;
              break;
            }
            c[65] = g;
            c[a >> 2] = b & -2;
            c[(h + 4) >> 2] = g | 1;
            c[(h + g) >> 2] = g;
            return;
          }
          d = e >>> 3;
          if (e >>> 0 < 256) {
            a = c[(h + 8) >> 2] | 0;
            b = c[(h + 12) >> 2] | 0;
            if ((b | 0) == (a | 0)) {
              c[63] = c[63] & ~(1 << d);
              i = h;
              b = g;
              break;
            } else {
              c[(a + 12) >> 2] = b;
              c[(b + 8) >> 2] = a;
              i = h;
              b = g;
              break;
            }
          }
          f = c[(h + 24) >> 2] | 0;
          a = c[(h + 12) >> 2] | 0;
          do
            if ((a | 0) == (h | 0)) {
              d = (h + 16) | 0;
              b = (d + 4) | 0;
              a = c[b >> 2] | 0;
              if (!a) {
                a = c[d >> 2] | 0;
                if (!a) {
                  a = 0;
                  break;
                } else b = d;
              }
              while (1) {
                d = (a + 20) | 0;
                e = c[d >> 2] | 0;
                if (e | 0) {
                  a = e;
                  b = d;
                  continue;
                }
                d = (a + 16) | 0;
                e = c[d >> 2] | 0;
                if (!e) break;
                else {
                  a = e;
                  b = d;
                }
              }
              c[b >> 2] = 0;
            } else {
              i = c[(h + 8) >> 2] | 0;
              c[(i + 12) >> 2] = a;
              c[(a + 8) >> 2] = i;
            }
          while (0);
          if (f) {
            b = c[(h + 28) >> 2] | 0;
            d = (556 + (b << 2)) | 0;
            if ((h | 0) == (c[d >> 2] | 0)) {
              c[d >> 2] = a;
              if (!a) {
                c[64] = c[64] & ~(1 << b);
                i = h;
                b = g;
                break;
              }
            } else {
              c[(f + 16 + ((((c[(f + 16) >> 2] | 0) != (h | 0)) & 1) << 2)) >> 2] = a;
              if (!a) {
                i = h;
                b = g;
                break;
              }
            }
            c[(a + 24) >> 2] = f;
            b = (h + 16) | 0;
            d = c[b >> 2] | 0;
            if (d | 0) {
              c[(a + 16) >> 2] = d;
              c[(d + 24) >> 2] = a;
            }
            b = c[(b + 4) >> 2] | 0;
            if (b) {
              c[(a + 20) >> 2] = b;
              c[(b + 24) >> 2] = a;
              i = h;
              b = g;
            } else {
              i = h;
              b = g;
            }
          } else {
            i = h;
            b = g;
          }
        } else {
          i = d;
          h = d;
        }
      while (0);
      if (h >>> 0 >= j >>> 0) return;
      a = (j + 4) | 0;
      e = c[a >> 2] | 0;
      if (!(e & 1)) return;
      if (!(e & 2)) {
        a = c[68] | 0;
        if ((j | 0) == (c[69] | 0)) {
          j = ((c[66] | 0) + b) | 0;
          c[66] = j;
          c[69] = i;
          c[(i + 4) >> 2] = j | 1;
          if ((i | 0) != (a | 0)) return;
          c[68] = 0;
          c[65] = 0;
          return;
        }
        if ((j | 0) == (a | 0)) {
          j = ((c[65] | 0) + b) | 0;
          c[65] = j;
          c[68] = h;
          c[(i + 4) >> 2] = j | 1;
          c[(h + j) >> 2] = j;
          return;
        }
        f = ((e & -8) + b) | 0;
        d = e >>> 3;
        do
          if (e >>> 0 < 256) {
            b = c[(j + 8) >> 2] | 0;
            a = c[(j + 12) >> 2] | 0;
            if ((a | 0) == (b | 0)) {
              c[63] = c[63] & ~(1 << d);
              break;
            } else {
              c[(b + 12) >> 2] = a;
              c[(a + 8) >> 2] = b;
              break;
            }
          } else {
            g = c[(j + 24) >> 2] | 0;
            a = c[(j + 12) >> 2] | 0;
            do
              if ((a | 0) == (j | 0)) {
                d = (j + 16) | 0;
                b = (d + 4) | 0;
                a = c[b >> 2] | 0;
                if (!a) {
                  a = c[d >> 2] | 0;
                  if (!a) {
                    d = 0;
                    break;
                  } else b = d;
                }
                while (1) {
                  d = (a + 20) | 0;
                  e = c[d >> 2] | 0;
                  if (e | 0) {
                    a = e;
                    b = d;
                    continue;
                  }
                  d = (a + 16) | 0;
                  e = c[d >> 2] | 0;
                  if (!e) break;
                  else {
                    a = e;
                    b = d;
                  }
                }
                c[b >> 2] = 0;
                d = a;
              } else {
                d = c[(j + 8) >> 2] | 0;
                c[(d + 12) >> 2] = a;
                c[(a + 8) >> 2] = d;
                d = a;
              }
            while (0);
            if (g | 0) {
              a = c[(j + 28) >> 2] | 0;
              b = (556 + (a << 2)) | 0;
              if ((j | 0) == (c[b >> 2] | 0)) {
                c[b >> 2] = d;
                if (!d) {
                  c[64] = c[64] & ~(1 << a);
                  break;
                }
              } else {
                c[(g + 16 + ((((c[(g + 16) >> 2] | 0) != (j | 0)) & 1) << 2)) >> 2] = d;
                if (!d) break;
              }
              c[(d + 24) >> 2] = g;
              a = (j + 16) | 0;
              b = c[a >> 2] | 0;
              if (b | 0) {
                c[(d + 16) >> 2] = b;
                c[(b + 24) >> 2] = d;
              }
              a = c[(a + 4) >> 2] | 0;
              if (a | 0) {
                c[(d + 20) >> 2] = a;
                c[(a + 24) >> 2] = d;
              }
            }
          }
        while (0);
        c[(i + 4) >> 2] = f | 1;
        c[(h + f) >> 2] = f;
        if ((i | 0) == (c[68] | 0)) {
          c[65] = f;
          return;
        }
      } else {
        c[a >> 2] = e & -2;
        c[(i + 4) >> 2] = b | 1;
        c[(h + b) >> 2] = b;
        f = b;
      }
      a = f >>> 3;
      if (f >>> 0 < 256) {
        d = (292 + ((a << 1) << 2)) | 0;
        b = c[63] | 0;
        a = 1 << a;
        if (!(b & a)) {
          c[63] = b | a;
          a = d;
          b = (d + 8) | 0;
        } else {
          b = (d + 8) | 0;
          a = c[b >> 2] | 0;
        }
        c[b >> 2] = i;
        c[(a + 12) >> 2] = i;
        c[(i + 8) >> 2] = a;
        c[(i + 12) >> 2] = d;
        return;
      }
      a = f >>> 8;
      if (a)
        if (f >>> 0 > 16777215) a = 31;
        else {
          h = (((a + 1048320) | 0) >>> 16) & 8;
          j = a << h;
          g = (((j + 520192) | 0) >>> 16) & 4;
          j = j << g;
          a = (((j + 245760) | 0) >>> 16) & 2;
          a = (14 - (g | h | a) + ((j << a) >>> 15)) | 0;
          a = ((f >>> ((a + 7) | 0)) & 1) | (a << 1);
        }
      else a = 0;
      e = (556 + (a << 2)) | 0;
      c[(i + 28) >> 2] = a;
      c[(i + 20) >> 2] = 0;
      c[(i + 16) >> 2] = 0;
      b = c[64] | 0;
      d = 1 << a;
      do
        if (b & d) {
          b = f << ((a | 0) == 31 ? 0 : (25 - (a >>> 1)) | 0);
          d = c[e >> 2] | 0;
          while (1) {
            if (((c[(d + 4) >> 2] & -8) | 0) == (f | 0)) {
              a = 73;
              break;
            }
            e = (d + 16 + ((b >>> 31) << 2)) | 0;
            a = c[e >> 2] | 0;
            if (!a) {
              a = 72;
              break;
            } else {
              b = b << 1;
              d = a;
            }
          }
          if ((a | 0) == 72) {
            c[e >> 2] = i;
            c[(i + 24) >> 2] = d;
            c[(i + 12) >> 2] = i;
            c[(i + 8) >> 2] = i;
            break;
          } else if ((a | 0) == 73) {
            h = (d + 8) | 0;
            j = c[h >> 2] | 0;
            c[(j + 12) >> 2] = i;
            c[h >> 2] = i;
            c[(i + 8) >> 2] = j;
            c[(i + 12) >> 2] = d;
            c[(i + 24) >> 2] = 0;
            break;
          }
        } else {
          c[64] = b | d;
          c[e >> 2] = i;
          c[(i + 24) >> 2] = e;
          c[(i + 12) >> 2] = i;
          c[(i + 8) >> 2] = i;
        }
      while (0);
      j = ((c[71] | 0) + -1) | 0;
      c[71] = j;
      if (!j) a = 708;
      else return;
      while (1) {
        a = c[a >> 2] | 0;
        if (!a) break;
        else a = (a + 8) | 0;
      }
      c[71] = -1;
      return;
    }
    function oa() {
      return ((pa() | 0) + 64) | 0;
    }
    function pa() {
      return qa() | 0;
    }
    function qa() {
      return 8;
    }
    function ra() {
      return 748;
    }
    function sa() {}
    function ta(a) {
      a = a | 0;
      var b = 0,
        d = 0;
      d = ((a + 15) & -16) | 0;
      b = c[i >> 2] | 0;
      a = (b + d) | 0;
      if ((((d | 0) > 0) & ((a | 0) < (b | 0))) | ((a | 0) < 0)) {
        W() | 0;
        X(12);
        return -1;
      }
      c[i >> 2] = a;
      if ((a | 0) > (V() | 0) ? (U() | 0) == 0 : 0) {
        c[i >> 2] = b;
        X(12);
        return -1;
      }
      return b | 0;
    }
    function ua(b, d, e) {
      b = b | 0;
      d = d | 0;
      e = e | 0;
      var f = 0,
        g = 0,
        h = 0,
        i = 0;
      h = (b + e) | 0;
      d = d & 255;
      if ((e | 0) >= 67) {
        while (b & 3) {
          a[b >> 0] = d;
          b = (b + 1) | 0;
        }
        f = (h & -4) | 0;
        g = (f - 64) | 0;
        i = d | (d << 8) | (d << 16) | (d << 24);
        while ((b | 0) <= (g | 0)) {
          c[b >> 2] = i;
          c[(b + 4) >> 2] = i;
          c[(b + 8) >> 2] = i;
          c[(b + 12) >> 2] = i;
          c[(b + 16) >> 2] = i;
          c[(b + 20) >> 2] = i;
          c[(b + 24) >> 2] = i;
          c[(b + 28) >> 2] = i;
          c[(b + 32) >> 2] = i;
          c[(b + 36) >> 2] = i;
          c[(b + 40) >> 2] = i;
          c[(b + 44) >> 2] = i;
          c[(b + 48) >> 2] = i;
          c[(b + 52) >> 2] = i;
          c[(b + 56) >> 2] = i;
          c[(b + 60) >> 2] = i;
          b = (b + 64) | 0;
        }
        while ((b | 0) < (f | 0)) {
          c[b >> 2] = i;
          b = (b + 4) | 0;
        }
      }
      while ((b | 0) < (h | 0)) {
        a[b >> 0] = d;
        b = (b + 1) | 0;
      }
      return (h - e) | 0;
    }
    function va(b, d, e) {
      b = b | 0;
      d = d | 0;
      e = e | 0;
      var f = 0,
        g = 0,
        h = 0;
      if ((e | 0) >= 8192) return Y(b | 0, d | 0, e | 0) | 0;
      h = b | 0;
      g = (b + e) | 0;
      if ((b & 3) == (d & 3)) {
        while (b & 3) {
          if (!e) return h | 0;
          a[b >> 0] = a[d >> 0] | 0;
          b = (b + 1) | 0;
          d = (d + 1) | 0;
          e = (e - 1) | 0;
        }
        e = (g & -4) | 0;
        f = (e - 64) | 0;
        while ((b | 0) <= (f | 0)) {
          c[b >> 2] = c[d >> 2];
          c[(b + 4) >> 2] = c[(d + 4) >> 2];
          c[(b + 8) >> 2] = c[(d + 8) >> 2];
          c[(b + 12) >> 2] = c[(d + 12) >> 2];
          c[(b + 16) >> 2] = c[(d + 16) >> 2];
          c[(b + 20) >> 2] = c[(d + 20) >> 2];
          c[(b + 24) >> 2] = c[(d + 24) >> 2];
          c[(b + 28) >> 2] = c[(d + 28) >> 2];
          c[(b + 32) >> 2] = c[(d + 32) >> 2];
          c[(b + 36) >> 2] = c[(d + 36) >> 2];
          c[(b + 40) >> 2] = c[(d + 40) >> 2];
          c[(b + 44) >> 2] = c[(d + 44) >> 2];
          c[(b + 48) >> 2] = c[(d + 48) >> 2];
          c[(b + 52) >> 2] = c[(d + 52) >> 2];
          c[(b + 56) >> 2] = c[(d + 56) >> 2];
          c[(b + 60) >> 2] = c[(d + 60) >> 2];
          b = (b + 64) | 0;
          d = (d + 64) | 0;
        }
        while ((b | 0) < (e | 0)) {
          c[b >> 2] = c[d >> 2];
          b = (b + 4) | 0;
          d = (d + 4) | 0;
        }
      } else {
        e = (g - 4) | 0;
        while ((b | 0) < (e | 0)) {
          a[b >> 0] = a[d >> 0] | 0;
          a[(b + 1) >> 0] = a[(d + 1) >> 0] | 0;
          a[(b + 2) >> 0] = a[(d + 2) >> 0] | 0;
          a[(b + 3) >> 0] = a[(d + 3) >> 0] | 0;
          b = (b + 4) | 0;
          d = (d + 4) | 0;
        }
      }
      while ((b | 0) < (g | 0)) {
        a[b >> 0] = a[d >> 0] | 0;
        b = (b + 1) | 0;
        d = (d + 1) | 0;
      }
      return h | 0;
    }

    // EMSCRIPTEN_END_FUNCS
    return {
      _malloc: ma,
      getTempRet0: fa,
      _free: na,
      runPostSets: sa,
      setTempRet0: ea,
      establishStackSpace: ca,
      _memset: ua,
      _transform_radix2_precalc_f: la,
      _precalc_f: ha,
      _precalc: ga,
      _dispose: ia,
      _memcpy: va,
      _emscripten_get_global_libc: ra,
      stackAlloc: $,
      setThrew: da,
      _sbrk: ta,
      stackRestore: ba,
      _transform_radix2_precalc: ka,
      stackSave: aa,
      _dispose_f: ja,
    };
  })(
    // EMSCRIPTEN_END_ASM
    Module.asmGlobalArg,
    Module.asmLibraryArg,
    buffer
  );
  var _precalc_f = (Module["_precalc_f"] = asm["_precalc_f"]);
  var getTempRet0 = (Module["getTempRet0"] = asm["getTempRet0"]);
  var _free = (Module["_free"] = asm["_free"]);
  var runPostSets = (Module["runPostSets"] = asm["runPostSets"]);
  var setTempRet0 = (Module["setTempRet0"] = asm["setTempRet0"]);
  var establishStackSpace = (Module["establishStackSpace"] = asm["establishStackSpace"]);
  var _memset = (Module["_memset"] = asm["_memset"]);
  var _transform_radix2_precalc_f = (Module["_transform_radix2_precalc_f"] = asm["_transform_radix2_precalc_f"]);
  var _malloc = (Module["_malloc"] = asm["_malloc"]);
  var _precalc = (Module["_precalc"] = asm["_precalc"]);
  var _dispose = (Module["_dispose"] = asm["_dispose"]);
  var _memcpy = (Module["_memcpy"] = asm["_memcpy"]);
  var _emscripten_get_global_libc = (Module["_emscripten_get_global_libc"] = asm["_emscripten_get_global_libc"]);
  var stackAlloc = (Module["stackAlloc"] = asm["stackAlloc"]);
  var setThrew = (Module["setThrew"] = asm["setThrew"]);
  var _sbrk = (Module["_sbrk"] = asm["_sbrk"]);
  var stackRestore = (Module["stackRestore"] = asm["stackRestore"]);
  var _transform_radix2_precalc = (Module["_transform_radix2_precalc"] = asm["_transform_radix2_precalc"]);
  var stackSave = (Module["stackSave"] = asm["stackSave"]);
  var _dispose_f = (Module["_dispose_f"] = asm["_dispose_f"]);
  Runtime.stackAlloc = Module["stackAlloc"];
  Runtime.stackSave = Module["stackSave"];
  Runtime.stackRestore = Module["stackRestore"];
  Runtime.establishStackSpace = Module["establishStackSpace"];
  Runtime.setTempRet0 = Module["setTempRet0"];
  Runtime.getTempRet0 = Module["getTempRet0"];
  Module["asm"] = asm;
  Module["then"] = function (func) {
    if (Module["calledRun"]) {
      func(Module);
    } else {
      var old = Module["onRuntimeInitialized"];
      Module["onRuntimeInitialized"] = function () {
        if (old) old();
        func(Module);
      };
    }
    return Module;
  };
  function ExitStatus(status) {
    this.name = "ExitStatus";
    this.message = "Program terminated with exit(" + status + ")";
    this.status = status;
  }
  ExitStatus.prototype = new Error();
  ExitStatus.prototype.constructor = ExitStatus;
  var initialStackTop;
  var preloadStartTime = null;
  var calledMain = false;
  dependenciesFulfilled = function runCaller() {
    if (!Module["calledRun"]) run();
    if (!Module["calledRun"]) dependenciesFulfilled = runCaller;
  };
  Module["callMain"] = Module.callMain = function callMain(args) {
    args = args || [];
    ensureInitRuntime();
    var argc = args.length + 1;
    function pad() {
      for (var i = 0; i < 4 - 1; i++) {
        argv.push(0);
      }
    }
    var argv = [allocate(intArrayFromString(Module["thisProgram"]), "i8", ALLOC_NORMAL)];
    pad();
    for (var i = 0; i < argc - 1; i = i + 1) {
      argv.push(allocate(intArrayFromString(args[i]), "i8", ALLOC_NORMAL));
      pad();
    }
    argv.push(0);
    argv = allocate(argv, "i32", ALLOC_NORMAL);
    try {
      var ret = Module["_main"](argc, argv, 0);
      exit(ret, true);
    } catch (e) {
      if (e instanceof ExitStatus) {
        return;
      } else if (e == "SimulateInfiniteLoop") {
        Module["noExitRuntime"] = true;
        return;
      } else {
        var toLog = e;
        if (e && typeof e === "object" && e.stack) {
          toLog = [e, e.stack];
        }
        Module.printErr("exception thrown: " + toLog);
        Module["quit"](1, e);
      }
    } finally {
      calledMain = true;
    }
  };
  function run(args) {
    args = args || Module["arguments"];
    if (preloadStartTime === null) preloadStartTime = Date.now();
    if (runDependencies > 0) {
      return;
    }
    preRun();
    if (runDependencies > 0) return;
    if (Module["calledRun"]) return;
    function doRun() {
      if (Module["calledRun"]) return;
      Module["calledRun"] = true;
      if (ABORT) return;
      ensureInitRuntime();
      preMain();
      if (Module["onRuntimeInitialized"]) Module["onRuntimeInitialized"]();
      if (Module["_main"] && shouldRunNow) Module["callMain"](args);
      postRun();
    }
    if (Module["setStatus"]) {
      Module["setStatus"]("Running...");
      setTimeout(function () {
        setTimeout(function () {
          Module["setStatus"]("");
        }, 1);
        doRun();
      }, 1);
    } else {
      doRun();
    }
  }
  Module["run"] = Module.run = run;
  function exit(status, implicit) {
    if (implicit && Module["noExitRuntime"]) {
      return;
    }
    if (Module["noExitRuntime"]) {
    } else {
      ABORT = true;
      EXITSTATUS = status;
      STACKTOP = initialStackTop;
      exitRuntime();
      if (Module["onExit"]) Module["onExit"](status);
    }
    if (ENVIRONMENT_IS_NODE) {
      process["exit"](status);
    }
    Module["quit"](status, new ExitStatus(status));
  }
  Module["exit"] = Module.exit = exit;
  var abortDecorators = [];
  function abort(what) {
    if (Module["onAbort"]) {
      Module["onAbort"](what);
    }
    if (what !== undefined) {
      Module.print(what);
      Module.printErr(what);
      what = JSON.stringify(what);
    } else {
      what = "";
    }
    ABORT = true;
    EXITSTATUS = 1;
    var extra = "\nIf this abort() is unexpected, build with -s ASSERTIONS=1 which can give more information.";
    var output = "abort(" + what + ") at " + stackTrace() + extra;
    if (abortDecorators) {
      abortDecorators.forEach(function (decorator) {
        output = decorator(output, what);
      });
    }
    throw output;
  }
  Module["abort"] = Module.abort = abort;
  if (Module["preInit"]) {
    if (typeof Module["preInit"] == "function") Module["preInit"] = [Module["preInit"]];
    while (Module["preInit"].length > 0) {
      Module["preInit"].pop()();
    }
  }
  var shouldRunNow = true;
  if (Module["noInitialRun"]) {
    shouldRunNow = false;
  }
  run();

  return NayukiCModule;
};
if (typeof module === "object" && module.exports) {
  module["exports"] = NayukiCModule;
}

export default NayukiCModule;

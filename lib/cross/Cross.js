var CrossModule = function (Module) {
  Module = Module || {};

  var Module;
  if (!Module) Module = (typeof CrossModule !== "undefined" ? CrossModule : null) || {};
  var moduleOverrides = {};
  for (var key in Module) {
    if (Module.hasOwnProperty(key)) {
      moduleOverrides[key] = Module[key];
    }
  }
  var ENVIRONMENT_IS_WEB = typeof window === "object";
  var ENVIRONMENT_IS_WORKER = typeof importScripts === "function";
  var ENVIRONMENT_IS_NODE =
    typeof process === "object" && typeof require === "function" && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER;
  var ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;
  if (ENVIRONMENT_IS_NODE) {
    if (!Module["print"])
      Module["print"] = function print(x) {
        process["stdout"].write(x + "\n");
      };
    if (!Module["printErr"])
      Module["printErr"] = function printErr(x) {
        process["stderr"].write(x + "\n");
      };
    var nodeFS = require("fs");
    var nodePath = require("path");
    Module["read"] = function read(filename, binary) {
      filename = nodePath["normalize"](filename);
      var ret = nodeFS["readFileSync"](filename);
      if (!ret && filename != nodePath["resolve"](filename)) {
        filename = path.join(__dirname, "..", "src", filename);
        ret = nodeFS["readFileSync"](filename);
      }
      if (ret && !binary) ret = ret.toString();
      return ret;
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
    if (typeof module !== "undefined") {
      module["exports"] = Module;
    }
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
      Module["read"] = function read() {
        throw "no read() available (jsc?)";
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
  } else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
    Module["read"] = function read(url) {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", url, false);
      xhr.send(null);
      return xhr.responseText;
    };
    if (typeof arguments != "undefined") {
      Module["arguments"] = arguments;
    }
    if (typeof console !== "undefined") {
      if (!Module["print"])
        Module["print"] = function print(x) {
          console.log(x);
        };
      if (!Module["printErr"])
        Module["printErr"] = function printErr(x) {
          console.log(x);
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
  Module.print = Module["print"];
  Module.printErr = Module["printErr"];
  Module["preRun"] = [];
  Module["postRun"] = [];
  for (var key in moduleOverrides) {
    if (moduleOverrides.hasOwnProperty(key)) {
      Module[key] = moduleOverrides[key];
    }
  }
  var Runtime = {
    setTempRet0: function (value) {
      tempRet0 = value;
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
        if (!args.splice) args = Array.prototype.slice.call(args);
        args.splice(0, 0, ptr);
        return Module["dynCall_" + sig].apply(null, args);
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
      assert(sig);
      if (!Runtime.funcWrappers[sig]) {
        Runtime.funcWrappers[sig] = {};
      }
      var sigCache = Runtime.funcWrappers[sig];
      if (!sigCache[func]) {
        sigCache[func] = function dynCall_wrapper() {
          return Runtime.dynCall(sig, func, arguments);
        };
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
      var ret = DYNAMICTOP;
      DYNAMICTOP = (DYNAMICTOP + size) | 0;
      DYNAMICTOP = (DYNAMICTOP + 15) & -16;
      if (DYNAMICTOP >= TOTAL_MEMORY) {
        var success = enlargeMemory();
        if (!success) {
          DYNAMICTOP = ret;
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
  var __THREW__ = 0;
  var ABORT = false;
  var EXITSTATUS = 0;
  var undef = 0;
  var tempValue,
    tempInt,
    tempBigInt,
    tempInt2,
    tempBigInt2,
    tempPair,
    tempBigIntI,
    tempBigIntR,
    tempBigIntS,
    tempBigIntP,
    tempBigIntD,
    tempDouble,
    tempFloat;
  var tempI64, tempI64b;
  var tempRet0, tempRet1, tempRet2, tempRet3, tempRet4, tempRet5, tempRet6, tempRet7, tempRet8, tempRet9;
  function assert(condition, text) {
    if (!condition) {
      abort("Assertion failed: " + text);
    }
  }
  var globalScope = this;
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
          ret = Runtime.stackAlloc((str.length << 2) + 1);
          writeStringToMemory(str, ret);
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
    var sourceRegex = /^function\s*\(([^)]*)\)\s*{\s*([^*]*?)[\s;]*(?:return\s*(.*?)[;\s]*)?}$/;
    function parseJSFunc(jsfunc) {
      var parsed = jsfunc.toString().match(sourceRegex).slice(1);
      return { arguments: parsed[0], body: parsed[1], returnValue: parsed[2] };
    }
    var JSsource = {};
    for (var fun in JSfuncs) {
      if (JSfuncs.hasOwnProperty(fun)) {
        JSsource[fun] = parseJSFunc(JSfuncs[fun]);
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
        funcstr += "var stack = " + JSsource["stackSave"].body + ";";
        for (var i = 0; i < nargs; i++) {
          var arg = argNames[i],
            type = argTypes[i];
          if (type === "number") continue;
          var convertCode = JSsource[type + "ToC"];
          funcstr += "var " + convertCode.arguments + " = " + arg + ";";
          funcstr += convertCode.body + ";";
          funcstr += arg + "=" + convertCode.returnValue + ";";
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
      ret = [_malloc, Runtime.stackAlloc, Runtime.staticAlloc, Runtime.dynamicAlloc][
        allocator === undefined ? ALLOC_STATIC : allocator
      ](Math.max(size, singleType ? 1 : types.length));
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
    if ((typeof _sbrk !== "undefined" && !_sbrk.called) || !runtimeInitialized) return Runtime.dynamicAlloc(size);
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
  function UTF8ArrayToString(u8Array, idx) {
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
  function UTF16ToString(ptr) {
    var i = 0;
    var str = "";
    while (1) {
      var codeUnit = HEAP16[(ptr + i * 2) >> 1];
      if (codeUnit == 0) return str;
      ++i;
      str += String.fromCharCode(codeUnit);
    }
  }
  Module["UTF16ToString"] = UTF16ToString;
  function stringToUTF16(str, outPtr, maxBytesToWrite) {
    if (maxBytesToWrite === undefined) {
      maxBytesToWrite = 2147483647;
    }
    if (maxBytesToWrite < 2) return 0;
    maxBytesToWrite -= 2;
    var startPtr = outPtr;
    var numCharsToWrite = maxBytesToWrite < str.length * 2 ? maxBytesToWrite / 2 : str.length;
    for (var i = 0; i < numCharsToWrite; ++i) {
      var codeUnit = str.charCodeAt(i);
      HEAP16[outPtr >> 1] = codeUnit;
      outPtr += 2;
    }
    HEAP16[outPtr >> 1] = 0;
    return outPtr - startPtr;
  }
  Module["stringToUTF16"] = stringToUTF16;
  function lengthBytesUTF16(str) {
    return str.length * 2;
  }
  Module["lengthBytesUTF16"] = lengthBytesUTF16;
  function UTF32ToString(ptr) {
    var i = 0;
    var str = "";
    while (1) {
      var utf32 = HEAP32[(ptr + i * 4) >> 2];
      if (utf32 == 0) return str;
      ++i;
      if (utf32 >= 65536) {
        var ch = utf32 - 65536;
        str += String.fromCharCode(55296 | (ch >> 10), 56320 | (ch & 1023));
      } else {
        str += String.fromCharCode(utf32);
      }
    }
  }
  Module["UTF32ToString"] = UTF32ToString;
  function stringToUTF32(str, outPtr, maxBytesToWrite) {
    if (maxBytesToWrite === undefined) {
      maxBytesToWrite = 2147483647;
    }
    if (maxBytesToWrite < 4) return 0;
    var startPtr = outPtr;
    var endPtr = startPtr + maxBytesToWrite - 4;
    for (var i = 0; i < str.length; ++i) {
      var codeUnit = str.charCodeAt(i);
      if (codeUnit >= 55296 && codeUnit <= 57343) {
        var trailSurrogate = str.charCodeAt(++i);
        codeUnit = (65536 + ((codeUnit & 1023) << 10)) | (trailSurrogate & 1023);
      }
      HEAP32[outPtr >> 2] = codeUnit;
      outPtr += 4;
      if (outPtr + 4 > endPtr) break;
    }
    HEAP32[outPtr >> 2] = 0;
    return outPtr - startPtr;
  }
  Module["stringToUTF32"] = stringToUTF32;
  function lengthBytesUTF32(str) {
    var len = 0;
    for (var i = 0; i < str.length; ++i) {
      var codeUnit = str.charCodeAt(i);
      if (codeUnit >= 55296 && codeUnit <= 57343) ++i;
      len += 4;
    }
    return len;
  }
  Module["lengthBytesUTF32"] = lengthBytesUTF32;
  function demangle(func) {
    var hasLibcxxabi = !!Module["___cxa_demangle"];
    if (hasLibcxxabi) {
      try {
        var buf = _malloc(func.length);
        writeStringToMemory(func.substr(1), buf);
        var status = _malloc(4);
        var ret = Module["___cxa_demangle"](buf, 0, 0, status);
        if (getValue(status, "i32") === 0 && ret) {
          return Pointer_stringify(ret);
        }
      } catch (e) {
      } finally {
        if (buf) _free(buf);
        if (status) _free(status);
        if (ret) _free(ret);
      }
    }
    var i = 3;
    var basicTypes = {
      v: "void",
      b: "bool",
      c: "char",
      s: "short",
      i: "int",
      l: "long",
      f: "float",
      d: "double",
      w: "wchar_t",
      a: "signed char",
      h: "unsigned char",
      t: "unsigned short",
      j: "unsigned int",
      m: "unsigned long",
      x: "long long",
      y: "unsigned long long",
      z: "...",
    };
    var subs = [];
    var first = true;
    function dump(x) {
      if (x) Module.print(x);
      Module.print(func);
      var pre = "";
      for (var a = 0; a < i; a++) pre += " ";
      Module.print(pre + "^");
    }
    function parseNested() {
      i++;
      if (func[i] === "K") i++;
      var parts = [];
      while (func[i] !== "E") {
        if (func[i] === "S") {
          i++;
          var next = func.indexOf("_", i);
          var num = func.substring(i, next) || 0;
          parts.push(subs[num] || "?");
          i = next + 1;
          continue;
        }
        if (func[i] === "C") {
          parts.push(parts[parts.length - 1]);
          i += 2;
          continue;
        }
        var size = parseInt(func.substr(i));
        var pre = size.toString().length;
        if (!size || !pre) {
          i--;
          break;
        }
        var curr = func.substr(i + pre, size);
        parts.push(curr);
        subs.push(curr);
        i += pre + size;
      }
      i++;
      return parts;
    }
    function parse(rawList, limit, allowVoid) {
      limit = limit || Infinity;
      var ret = "",
        list = [];
      function flushList() {
        return "(" + list.join(", ") + ")";
      }
      var name;
      if (func[i] === "N") {
        name = parseNested().join("::");
        limit--;
        if (limit === 0) return rawList ? [name] : name;
      } else {
        if (func[i] === "K" || (first && func[i] === "L")) i++;
        var size = parseInt(func.substr(i));
        if (size) {
          var pre = size.toString().length;
          name = func.substr(i + pre, size);
          i += pre + size;
        }
      }
      first = false;
      if (func[i] === "I") {
        i++;
        var iList = parse(true);
        var iRet = parse(true, 1, true);
        ret += iRet[0] + " " + name + "<" + iList.join(", ") + ">";
      } else {
        ret = name;
      }
      paramLoop: while (i < func.length && limit-- > 0) {
        var c = func[i++];
        if (c in basicTypes) {
          list.push(basicTypes[c]);
        } else {
          switch (c) {
            case "P":
              list.push(parse(true, 1, true)[0] + "*");
              break;
            case "R":
              list.push(parse(true, 1, true)[0] + "&");
              break;
            case "L": {
              i++;
              var end = func.indexOf("E", i);
              var size = end - i;
              list.push(func.substr(i, size));
              i += size + 2;
              break;
            }
            case "A": {
              var size = parseInt(func.substr(i));
              i += size.toString().length;
              if (func[i] !== "_") throw "?";
              i++;
              list.push(parse(true, 1, true)[0] + " [" + size + "]");
              break;
            }
            case "E":
              break paramLoop;
            default:
              ret += "?" + c;
              break paramLoop;
          }
        }
      }
      if (!allowVoid && list.length === 1 && list[0] === "void") list = [];
      if (rawList) {
        if (ret) {
          list.push(ret + "?");
        }
        return list;
      } else {
        return ret + flushList();
      }
    }
    var parsed = func;
    try {
      if (func == "Object._main" || func == "_main") {
        return "main()";
      }
      if (typeof func === "number") func = Pointer_stringify(func);
      if (func[0] !== "_") return func;
      if (func[1] !== "_") return func;
      if (func[2] !== "Z") return func;
      switch (func[3]) {
        case "n":
          return "operator new()";
        case "d":
          return "operator delete()";
      }
      parsed = parse();
    } catch (e) {
      parsed += "?";
    }
    if (parsed.indexOf("?") >= 0 && !hasLibcxxabi) {
      Runtime.warnOnce(
        "warning: a problem occurred in builtin C++ name demangling; build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling"
      );
    }
    return parsed;
  }
  function demangleAll(text) {
    return text.replace(/__Z[\w\d_]+/g, function (x) {
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
    return demangleAll(jsStackTrace());
  }
  Module["stackTrace"] = stackTrace;
  var PAGE_SIZE = 4096;
  function alignMemoryPage(x) {
    if (x % 4096 > 0) {
      x += 4096 - (x % 4096);
    }
    return x;
  }
  var HEAP;
  var HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;
  var STATIC_BASE = 0,
    STATICTOP = 0,
    staticSealed = false;
  var STACK_BASE = 0,
    STACKTOP = 0,
    STACK_MAX = 0;
  var DYNAMIC_BASE = 0,
    DYNAMICTOP = 0;
  function enlargeMemory() {
    abort(
      "Cannot enlarge memory arrays. Either (1) compile with -s TOTAL_MEMORY=X with X higher than the current value " +
        TOTAL_MEMORY +
        ", (2) compile with ALLOW_MEMORY_GROWTH which adjusts the size at runtime but prevents some optimizations, or (3) set Module.TOTAL_MEMORY before the program runs."
    );
  }
  var TOTAL_STACK = Module["TOTAL_STACK"] || 5242880;
  var TOTAL_MEMORY = Module["TOTAL_MEMORY"] || 16777216;
  var totalMemory = 64 * 1024;
  while (totalMemory < TOTAL_MEMORY || totalMemory < 2 * TOTAL_STACK) {
    if (totalMemory < 16 * 1024 * 1024) {
      totalMemory *= 2;
    } else {
      totalMemory += 16 * 1024 * 1024;
    }
  }
  if (totalMemory !== TOTAL_MEMORY) {
    TOTAL_MEMORY = totalMemory;
  }
  assert(
    typeof Int32Array !== "undefined" &&
      typeof Float64Array !== "undefined" &&
      !!new Int32Array(1)["subarray"] &&
      !!new Int32Array(1)["set"],
    "JS engine does not provide full typed array support"
  );
  var buffer;
  buffer = new ArrayBuffer(TOTAL_MEMORY);
  HEAP8 = new Int8Array(buffer);
  HEAP16 = new Int16Array(buffer);
  HEAP32 = new Int32Array(buffer);
  HEAPU8 = new Uint8Array(buffer);
  HEAPU16 = new Uint16Array(buffer);
  HEAPU32 = new Uint32Array(buffer);
  HEAPF32 = new Float32Array(buffer);
  HEAPF64 = new Float64Array(buffer);
  HEAP32[0] = 255;
  assert(HEAPU8[0] === 255 && HEAPU8[3] === 0, "Typed arrays 2 must be run on a little-endian system");
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
          Runtime.dynCall("v", func);
        } else {
          Runtime.dynCall("vi", func, [callback.arg]);
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
    var array = intArrayFromString(string, dontAddNull);
    var i = 0;
    while (i < array.length) {
      var chr = array[i];
      HEAP8[(buffer + i) >> 0] = chr;
      i = i + 1;
    }
  }
  Module["writeStringToMemory"] = writeStringToMemory;
  function writeArrayToMemory(array, buffer) {
    for (var i = 0; i < array.length; i++) {
      HEAP8[buffer++ >> 0] = array[i];
    }
  }
  Module["writeArrayToMemory"] = writeArrayToMemory;
  function writeAsciiToMemory(str, buffer, dontAddNull) {
    for (var i = 0; i < str.length; ++i) {
      HEAP8[buffer++ >> 0] = str.charCodeAt(i);
    }
    if (!dontAddNull) HEAP8[buffer >> 0] = 0;
  }
  Module["writeAsciiToMemory"] = writeAsciiToMemory;
  function unSign(value, bits, ignore) {
    if (value >= 0) {
      return value;
    }
    return bits <= 32 ? 2 * Math.abs(1 << (bits - 1)) + value : Math.pow(2, bits) + value;
  }
  function reSign(value, bits, ignore) {
    if (value <= 0) {
      return value;
    }
    var half = bits <= 32 ? Math.abs(1 << (bits - 1)) : Math.pow(2, bits - 1);
    if (value >= half && (bits <= 32 || value > half)) {
      value = -2 * half + value;
    }
    return value;
  }
  if (!Math["imul"] || Math["imul"](4294967295, 5) !== -5)
    Math["imul"] = function imul(a, b) {
      var ah = a >>> 16;
      var al = a & 65535;
      var bh = b >>> 16;
      var bl = b & 65535;
      return (al * bl + ((ah * bl + al * bh) << 16)) | 0;
    };
  Math.imul = Math["imul"];
  if (!Math["clz32"])
    Math["clz32"] = function (x) {
      x = x >>> 0;
      for (var i = 0; i < 32; i++) {
        if (x & (1 << (31 - i))) return i;
      }
      return 32;
    };
  Math.clz32 = Math["clz32"];
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
  var Math_min = Math.min;
  var Math_clz32 = Math.clz32;
  var runDependencies = 0;
  var runDependencyWatcher = null;
  var dependenciesFulfilled = null;
  function getUniqueRunDependency(id) {
    return id;
  }
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
  var memoryInitializer = null;
  var ASM_CONSTS = [];
  STATIC_BASE = 8;
  STATICTOP = STATIC_BASE + 560;
  __ATINIT__.push();
  allocate(
    [
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
    "i8",
    ALLOC_NONE,
    Runtime.GLOBAL_BASE
  );
  var tempDoublePtr = Runtime.alignMemory(allocate(12, "i8", ALLOC_STATIC), 8);
  assert(tempDoublePtr % 8 == 0);
  function copyTempFloat(ptr) {
    HEAP8[tempDoublePtr] = HEAP8[ptr];
    HEAP8[tempDoublePtr + 1] = HEAP8[ptr + 1];
    HEAP8[tempDoublePtr + 2] = HEAP8[ptr + 2];
    HEAP8[tempDoublePtr + 3] = HEAP8[ptr + 3];
  }
  function copyTempDouble(ptr) {
    HEAP8[tempDoublePtr] = HEAP8[ptr];
    HEAP8[tempDoublePtr + 1] = HEAP8[ptr + 1];
    HEAP8[tempDoublePtr + 2] = HEAP8[ptr + 2];
    HEAP8[tempDoublePtr + 3] = HEAP8[ptr + 3];
    HEAP8[tempDoublePtr + 4] = HEAP8[ptr + 4];
    HEAP8[tempDoublePtr + 5] = HEAP8[ptr + 5];
    HEAP8[tempDoublePtr + 6] = HEAP8[ptr + 6];
    HEAP8[tempDoublePtr + 7] = HEAP8[ptr + 7];
  }
  function _llvm_stackrestore(p) {
    var self = _llvm_stacksave;
    var ret = self.LLVM_SAVEDSTACKS[p];
    self.LLVM_SAVEDSTACKS.splice(p, 1);
    Runtime.stackRestore(ret);
  }
  function ___setErrNo(value) {
    if (Module["___errno_location"]) HEAP32[Module["___errno_location"]() >> 2] = value;
    return value;
  }
  var ERRNO_CODES = {
    EPERM: 1,
    ENOENT: 2,
    ESRCH: 3,
    EINTR: 4,
    EIO: 5,
    ENXIO: 6,
    E2BIG: 7,
    ENOEXEC: 8,
    EBADF: 9,
    ECHILD: 10,
    EAGAIN: 11,
    EWOULDBLOCK: 11,
    ENOMEM: 12,
    EACCES: 13,
    EFAULT: 14,
    ENOTBLK: 15,
    EBUSY: 16,
    EEXIST: 17,
    EXDEV: 18,
    ENODEV: 19,
    ENOTDIR: 20,
    EISDIR: 21,
    EINVAL: 22,
    ENFILE: 23,
    EMFILE: 24,
    ENOTTY: 25,
    ETXTBSY: 26,
    EFBIG: 27,
    ENOSPC: 28,
    ESPIPE: 29,
    EROFS: 30,
    EMLINK: 31,
    EPIPE: 32,
    EDOM: 33,
    ERANGE: 34,
    ENOMSG: 42,
    EIDRM: 43,
    ECHRNG: 44,
    EL2NSYNC: 45,
    EL3HLT: 46,
    EL3RST: 47,
    ELNRNG: 48,
    EUNATCH: 49,
    ENOCSI: 50,
    EL2HLT: 51,
    EDEADLK: 35,
    ENOLCK: 37,
    EBADE: 52,
    EBADR: 53,
    EXFULL: 54,
    ENOANO: 55,
    EBADRQC: 56,
    EBADSLT: 57,
    EDEADLOCK: 35,
    EBFONT: 59,
    ENOSTR: 60,
    ENODATA: 61,
    ETIME: 62,
    ENOSR: 63,
    ENONET: 64,
    ENOPKG: 65,
    EREMOTE: 66,
    ENOLINK: 67,
    EADV: 68,
    ESRMNT: 69,
    ECOMM: 70,
    EPROTO: 71,
    EMULTIHOP: 72,
    EDOTDOT: 73,
    EBADMSG: 74,
    ENOTUNIQ: 76,
    EBADFD: 77,
    EREMCHG: 78,
    ELIBACC: 79,
    ELIBBAD: 80,
    ELIBSCN: 81,
    ELIBMAX: 82,
    ELIBEXEC: 83,
    ENOSYS: 38,
    ENOTEMPTY: 39,
    ENAMETOOLONG: 36,
    ELOOP: 40,
    EOPNOTSUPP: 95,
    EPFNOSUPPORT: 96,
    ECONNRESET: 104,
    ENOBUFS: 105,
    EAFNOSUPPORT: 97,
    EPROTOTYPE: 91,
    ENOTSOCK: 88,
    ENOPROTOOPT: 92,
    ESHUTDOWN: 108,
    ECONNREFUSED: 111,
    EADDRINUSE: 98,
    ECONNABORTED: 103,
    ENETUNREACH: 101,
    ENETDOWN: 100,
    ETIMEDOUT: 110,
    EHOSTDOWN: 112,
    EHOSTUNREACH: 113,
    EINPROGRESS: 115,
    EALREADY: 114,
    EDESTADDRREQ: 89,
    EMSGSIZE: 90,
    EPROTONOSUPPORT: 93,
    ESOCKTNOSUPPORT: 94,
    EADDRNOTAVAIL: 99,
    ENETRESET: 102,
    EISCONN: 106,
    ENOTCONN: 107,
    ETOOMANYREFS: 109,
    EUSERS: 87,
    EDQUOT: 122,
    ESTALE: 116,
    ENOTSUP: 95,
    ENOMEDIUM: 123,
    EILSEQ: 84,
    EOVERFLOW: 75,
    ECANCELED: 125,
    ENOTRECOVERABLE: 131,
    EOWNERDEAD: 130,
    ESTRPIPE: 86,
  };
  function _sysconf(name) {
    switch (name) {
      case 30:
        return PAGE_SIZE;
      case 85:
        return totalMemory / PAGE_SIZE;
      case 132:
      case 133:
      case 12:
      case 137:
      case 138:
      case 15:
      case 235:
      case 16:
      case 17:
      case 18:
      case 19:
      case 20:
      case 149:
      case 13:
      case 10:
      case 236:
      case 153:
      case 9:
      case 21:
      case 22:
      case 159:
      case 154:
      case 14:
      case 77:
      case 78:
      case 139:
      case 80:
      case 81:
      case 82:
      case 68:
      case 67:
      case 164:
      case 11:
      case 29:
      case 47:
      case 48:
      case 95:
      case 52:
      case 51:
      case 46:
        return 200809;
      case 79:
        return 0;
      case 27:
      case 246:
      case 127:
      case 128:
      case 23:
      case 24:
      case 160:
      case 161:
      case 181:
      case 182:
      case 242:
      case 183:
      case 184:
      case 243:
      case 244:
      case 245:
      case 165:
      case 178:
      case 179:
      case 49:
      case 50:
      case 168:
      case 169:
      case 175:
      case 170:
      case 171:
      case 172:
      case 97:
      case 76:
      case 32:
      case 173:
      case 35:
        return -1;
      case 176:
      case 177:
      case 7:
      case 155:
      case 8:
      case 157:
      case 125:
      case 126:
      case 92:
      case 93:
      case 129:
      case 130:
      case 131:
      case 94:
      case 91:
        return 1;
      case 74:
      case 60:
      case 69:
      case 70:
      case 4:
        return 1024;
      case 31:
      case 42:
      case 72:
        return 32;
      case 87:
      case 26:
      case 33:
        return 2147483647;
      case 34:
      case 1:
        return 47839;
      case 38:
      case 36:
        return 99;
      case 43:
      case 37:
        return 2048;
      case 0:
        return 2097152;
      case 3:
        return 65536;
      case 28:
        return 32768;
      case 44:
        return 32767;
      case 75:
        return 16384;
      case 39:
        return 1e3;
      case 89:
        return 700;
      case 71:
        return 256;
      case 40:
        return 255;
      case 2:
        return 100;
      case 180:
        return 64;
      case 25:
        return 20;
      case 5:
        return 16;
      case 6:
        return 6;
      case 73:
        return 4;
      case 84: {
        if (typeof navigator === "object") return navigator["hardwareConcurrency"] || 1;
        return 1;
      }
    }
    ___setErrNo(ERRNO_CODES.EINVAL);
    return -1;
  }
  function _llvm_stacksave() {
    var self = _llvm_stacksave;
    if (!self.LLVM_SAVEDSTACKS) {
      self.LLVM_SAVEDSTACKS = [];
    }
    self.LLVM_SAVEDSTACKS.push(Runtime.stackSave());
    return self.LLVM_SAVEDSTACKS.length - 1;
  }
  Module["_memset"] = _memset;
  var _cos = Math_cos;
  function _emscripten_memcpy_big(dest, src, num) {
    HEAPU8.set(HEAPU8.subarray(src, src + num), dest);
    return dest;
  }
  Module["_memcpy"] = _memcpy;
  function _abort() {
    Module["abort"]();
  }
  function _sbrk(bytes) {
    var self = _sbrk;
    if (!self.called) {
      DYNAMICTOP = alignMemoryPage(DYNAMICTOP);
      self.called = true;
      assert(Runtime.dynamicAlloc);
      self.alloc = Runtime.dynamicAlloc;
      Runtime.dynamicAlloc = function () {
        abort("cannot dynamically allocate, sbrk now has control");
      };
    }
    var ret = DYNAMICTOP;
    if (bytes != 0) {
      var success = self.alloc(bytes);
      if (!success) return -1 >>> 0;
    }
    return ret;
  }
  function _time(ptr) {
    var ret = (Date.now() / 1e3) | 0;
    if (ptr) {
      HEAP32[ptr >> 2] = ret;
    }
    return ret;
  }
  function _pthread_self() {
    return 0;
  }
  var _sin = Math_sin;
  STACK_BASE = STACKTOP = Runtime.alignMemory(STATICTOP);
  staticSealed = true;
  STACK_MAX = STACK_BASE + TOTAL_STACK;
  DYNAMIC_BASE = DYNAMICTOP = Runtime.alignMemory(STACK_MAX);
  assert(DYNAMIC_BASE < TOTAL_MEMORY, "TOTAL_MEMORY not big enough for stack");
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
    _sin: _sin,
    _cos: _cos,
    _pthread_self: _pthread_self,
    _abort: _abort,
    ___setErrNo: ___setErrNo,
    _llvm_stacksave: _llvm_stacksave,
    _sbrk: _sbrk,
    _time: _time,
    _emscripten_memcpy_big: _emscripten_memcpy_big,
    _llvm_stackrestore: _llvm_stackrestore,
    _sysconf: _sysconf,
    STACKTOP: STACKTOP,
    STACK_MAX: STACK_MAX,
    tempDoublePtr: tempDoublePtr,
    ABORT: ABORT,
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
    var i = env.STACKTOP | 0;
    var j = env.STACK_MAX | 0;
    var k = env.tempDoublePtr | 0;
    var l = env.ABORT | 0;
    var m = 0;
    var n = 0;
    var o = 0;
    var p = 0;
    var q = global.NaN,
      r = global.Infinity;
    var s = 0,
      t = 0,
      u = 0,
      v = 0,
      w = 0.0,
      x = 0,
      y = 0,
      z = 0,
      A = 0.0;
    var B = 0;
    var C = 0;
    var D = 0;
    var E = 0;
    var F = 0;
    var G = 0;
    var H = 0;
    var I = 0;
    var J = 0;
    var K = 0;
    var L = global.Math.floor;
    var M = global.Math.abs;
    var N = global.Math.sqrt;
    var O = global.Math.pow;
    var P = global.Math.cos;
    var Q = global.Math.sin;
    var R = global.Math.tan;
    var S = global.Math.acos;
    var T = global.Math.asin;
    var U = global.Math.atan;
    var V = global.Math.atan2;
    var W = global.Math.exp;
    var X = global.Math.log;
    var Y = global.Math.ceil;
    var Z = global.Math.imul;
    var _ = global.Math.min;
    var $ = global.Math.clz32;
    var aa = env.abort;
    var ba = env.assert;
    var ca = env._sin;
    var da = env._cos;
    var ea = env._pthread_self;
    var fa = env._abort;
    var ga = env.___setErrNo;
    var ha = env._llvm_stacksave;
    var ia = env._sbrk;
    var ja = env._time;
    var ka = env._emscripten_memcpy_big;
    var la = env._llvm_stackrestore;
    var ma = env._sysconf;
    var na = 0.0;
    // EMSCRIPTEN_START_FUNCS
    function oa(a) {
      a = a | 0;
      var b = 0;
      b = i;
      i = (i + a) | 0;
      i = (i + 15) & -16;
      return b | 0;
    }
    function pa() {
      return i | 0;
    }
    function qa(a) {
      a = a | 0;
      i = a;
    }
    function ra(a, b) {
      a = a | 0;
      b = b | 0;
      i = a;
      j = b;
    }
    function sa(a, b) {
      a = a | 0;
      b = b | 0;
      if (!m) {
        m = a;
        n = b;
      }
    }
    function ta(b) {
      b = b | 0;
      a[k >> 0] = a[b >> 0];
      a[(k + 1) >> 0] = a[(b + 1) >> 0];
      a[(k + 2) >> 0] = a[(b + 2) >> 0];
      a[(k + 3) >> 0] = a[(b + 3) >> 0];
    }
    function ua(b) {
      b = b | 0;
      a[k >> 0] = a[b >> 0];
      a[(k + 1) >> 0] = a[(b + 1) >> 0];
      a[(k + 2) >> 0] = a[(b + 2) >> 0];
      a[(k + 3) >> 0] = a[(b + 3) >> 0];
      a[(k + 4) >> 0] = a[(b + 4) >> 0];
      a[(k + 5) >> 0] = a[(b + 5) >> 0];
      a[(k + 6) >> 0] = a[(b + 6) >> 0];
      a[(k + 7) >> 0] = a[(b + 7) >> 0];
    }
    function va(a) {
      a = a | 0;
      B = a;
    }
    function wa() {
      return B | 0;
    }
    function xa(a, b, d, e, f, g) {
      a = a | 0;
      b = b | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      g = g | 0;
      var j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0.0,
        p = 0.0,
        q = 0.0,
        r = 0.0,
        s = 0.0,
        t = 0.0,
        u = 0.0,
        v = 0.0,
        w = 0.0,
        x = 0.0,
        y = 0.0,
        z = 0,
        A = 0,
        B = 0,
        C = 0.0,
        D = 0,
        E = 0.0,
        F = 0.0;
      D = i;
      if ((a >>> 0 < 2) | ((((d | 0) != 0) & ((f | 0) != 0) & ((g | 0) != 0)) ^ 1)) {
        i = D;
        return;
      }
      if ((a + -1) & a) {
        i = D;
        return;
      }
      B = (b | 0) != 0;
      b = 0;
      while (1)
        if (!((1 << b) & a)) b = (b + 1) | 0;
        else break;
      y = B ? -6.283185307179586 : 6.283185307179586;
      A = ha() | 0;
      n = i;
      i = (i + ((((1 * (a << 2)) | 0) + 15) & -16)) | 0;
      z = (a | 0) == 0;
      do
        if (!z) {
          if (!b) {
            Ca(n | 0, 0, (a << 2) | 0) | 0;
            break;
          } else m = 0;
          do {
            k = 0;
            j = 0;
            l = m;
            while (1) {
              j = (j << 1) | (l & 1);
              k = (k + 1) | 0;
              if ((k | 0) == (b | 0)) break;
              else l = l >>> 1;
            }
            c[(n + (m << 2)) >> 2] = j;
            m = (m + 1) | 0;
          } while ((m | 0) != (a | 0));
        }
      while (0);
      if (!e)
        if (z) {
          d = 1;
          j = 2;
        } else {
          b = 0;
          do {
            e = c[(n + (b << 2)) >> 2] | 0;
            h[(f + (e << 3)) >> 3] = +h[(d + (b << 3)) >> 3];
            h[(g + (e << 3)) >> 3] = 0.0;
            b = (b + 1) | 0;
          } while ((b | 0) != (a | 0));
          d = 1;
          j = 2;
        }
      else if (z) {
        d = 1;
        j = 2;
      } else {
        b = 0;
        do {
          m = c[(n + (b << 2)) >> 2] | 0;
          h[(f + (m << 3)) >> 3] = +h[(d + (b << 3)) >> 3];
          h[(g + (m << 3)) >> 3] = +h[(e + (b << 3)) >> 3];
          b = (b + 1) | 0;
        } while ((b | 0) != (a | 0));
        d = 1;
        j = 2;
      }
      while (1) {
        x = y / +(j >>> 0);
        t = x * -2.0;
        r = -+Q(+t);
        s = -+Q(+-x);
        t = +P(+t);
        x = +P(+x);
        u = x * 2.0;
        a: do
          if (!z) {
            if (!d) {
              b = 0;
              while (1) {
                b = (b + j) | 0;
                if (b >>> 0 >= a >>> 0) break a;
              }
            } else {
              e = 0;
              n = d;
            }
            while (1) {
              v = s;
              q = r;
              w = x;
              o = t;
              m = e;
              while (1) {
                p = u * w - o;
                o = u * v - q;
                l = (m + d) | 0;
                b = (f + (l << 3)) | 0;
                F = +h[b >> 3];
                l = (g + (l << 3)) | 0;
                q = +h[l >> 3];
                E = p * F - o * q;
                q = o * F + p * q;
                k = (f + (m << 3)) | 0;
                h[b >> 3] = +h[k >> 3] - E;
                b = (g + (m << 3)) | 0;
                h[l >> 3] = +h[b >> 3] - q;
                h[k >> 3] = E + +h[k >> 3];
                h[b >> 3] = q + +h[b >> 3];
                m = (m + 1) | 0;
                if ((m | 0) == (n | 0)) break;
                else {
                  E = w;
                  q = v;
                  v = o;
                  w = p;
                  o = E;
                }
              }
              e = (e + j) | 0;
              if (e >>> 0 >= a >>> 0) break;
              else n = (n + j) | 0;
            }
          }
        while (0);
        b = j << 1;
        if (b >>> 0 > a >>> 0) break;
        else {
          d = j;
          j = b;
        }
      }
      if (B ? ((C = +(a >>> 0)), !z) : 0) {
        b = 0;
        do {
          z = (f + (b << 3)) | 0;
          h[z >> 3] = +h[z >> 3] / C;
          z = (g + (b << 3)) | 0;
          h[z >> 3] = +h[z >> 3] / C;
          b = (b + 1) | 0;
        } while ((b | 0) != (a | 0));
      }
      la(A | 0);
      i = D;
      return;
    }
    function ya() {
      var a = 0;
      if (!(c[2] | 0)) a = 52;
      else a = c[((ea() | 0) + 60) >> 2] | 0;
      return a | 0;
    }
    function za(a) {
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
        l = 0,
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
        x = 0,
        y = 0,
        z = 0,
        A = 0,
        B = 0,
        C = 0,
        D = 0,
        E = 0,
        F = 0,
        G = 0,
        H = 0,
        I = 0,
        J = 0,
        K = 0,
        L = 0,
        M = 0,
        N = 0;
      do
        if (a >>> 0 < 245) {
          q = a >>> 0 < 11 ? 16 : (a + 11) & -8;
          a = q >>> 3;
          l = c[14] | 0;
          j = l >>> a;
          if (j & 3) {
            e = (((j & 1) ^ 1) + a) | 0;
            f = e << 1;
            b = (96 + (f << 2)) | 0;
            f = (96 + ((f + 2) << 2)) | 0;
            g = c[f >> 2] | 0;
            h = (g + 8) | 0;
            i = c[h >> 2] | 0;
            do
              if ((b | 0) != (i | 0)) {
                if (i >>> 0 < (c[18] | 0) >>> 0) fa();
                d = (i + 12) | 0;
                if ((c[d >> 2] | 0) == (g | 0)) {
                  c[d >> 2] = b;
                  c[f >> 2] = i;
                  break;
                } else fa();
              } else c[14] = l & ~(1 << e);
            while (0);
            w = e << 3;
            c[(g + 4) >> 2] = w | 3;
            w = (g + (w | 4)) | 0;
            c[w >> 2] = c[w >> 2] | 1;
            w = h;
            return w | 0;
          }
          f = c[16] | 0;
          if (q >>> 0 > f >>> 0) {
            if (j) {
              b = 2 << a;
              b = (j << a) & (b | (0 - b));
              b = ((b & (0 - b)) + -1) | 0;
              a = (b >>> 12) & 16;
              b = b >>> a;
              d = (b >>> 5) & 8;
              b = b >>> d;
              e = (b >>> 2) & 4;
              b = b >>> e;
              g = (b >>> 1) & 2;
              b = b >>> g;
              h = (b >>> 1) & 1;
              h = ((d | a | e | g | h) + (b >>> h)) | 0;
              b = h << 1;
              g = (96 + (b << 2)) | 0;
              b = (96 + ((b + 2) << 2)) | 0;
              e = c[b >> 2] | 0;
              a = (e + 8) | 0;
              d = c[a >> 2] | 0;
              do
                if ((g | 0) != (d | 0)) {
                  if (d >>> 0 < (c[18] | 0) >>> 0) fa();
                  i = (d + 12) | 0;
                  if ((c[i >> 2] | 0) == (e | 0)) {
                    c[i >> 2] = g;
                    c[b >> 2] = d;
                    k = c[16] | 0;
                    break;
                  } else fa();
                } else {
                  c[14] = l & ~(1 << h);
                  k = f;
                }
              while (0);
              w = h << 3;
              f = (w - q) | 0;
              c[(e + 4) >> 2] = q | 3;
              j = (e + q) | 0;
              c[(e + (q | 4)) >> 2] = f | 1;
              c[(e + w) >> 2] = f;
              if (k) {
                d = c[19] | 0;
                g = k >>> 3;
                i = g << 1;
                b = (96 + (i << 2)) | 0;
                h = c[14] | 0;
                g = 1 << g;
                if (h & g) {
                  h = (96 + ((i + 2) << 2)) | 0;
                  i = c[h >> 2] | 0;
                  if (i >>> 0 < (c[18] | 0) >>> 0) fa();
                  else {
                    m = h;
                    n = i;
                  }
                } else {
                  c[14] = h | g;
                  m = (96 + ((i + 2) << 2)) | 0;
                  n = b;
                }
                c[m >> 2] = d;
                c[(n + 12) >> 2] = d;
                c[(d + 8) >> 2] = n;
                c[(d + 12) >> 2] = b;
              }
              c[16] = f;
              c[19] = j;
              w = a;
              return w | 0;
            }
            a = c[15] | 0;
            if (a) {
              h = ((a & (0 - a)) + -1) | 0;
              v = (h >>> 12) & 16;
              h = h >>> v;
              u = (h >>> 5) & 8;
              h = h >>> u;
              w = (h >>> 2) & 4;
              h = h >>> w;
              i = (h >>> 1) & 2;
              h = h >>> i;
              g = (h >>> 1) & 1;
              g = c[(360 + (((u | v | w | i | g) + (h >>> g)) << 2)) >> 2] | 0;
              h = ((c[(g + 4) >> 2] & -8) - q) | 0;
              i = g;
              while (1) {
                d = c[(i + 16) >> 2] | 0;
                if (!d) {
                  d = c[(i + 20) >> 2] | 0;
                  if (!d) {
                    l = h;
                    k = g;
                    break;
                  }
                }
                i = ((c[(d + 4) >> 2] & -8) - q) | 0;
                w = i >>> 0 < h >>> 0;
                h = w ? i : h;
                i = d;
                g = w ? d : g;
              }
              a = c[18] | 0;
              if (k >>> 0 < a >>> 0) fa();
              f = (k + q) | 0;
              if (k >>> 0 >= f >>> 0) fa();
              j = c[(k + 24) >> 2] | 0;
              g = c[(k + 12) >> 2] | 0;
              do
                if ((g | 0) == (k | 0)) {
                  h = (k + 20) | 0;
                  i = c[h >> 2] | 0;
                  if (!i) {
                    h = (k + 16) | 0;
                    i = c[h >> 2] | 0;
                    if (!i) {
                      e = 0;
                      break;
                    }
                  }
                  while (1) {
                    g = (i + 20) | 0;
                    b = c[g >> 2] | 0;
                    if (b) {
                      i = b;
                      h = g;
                      continue;
                    }
                    g = (i + 16) | 0;
                    b = c[g >> 2] | 0;
                    if (!b) break;
                    else {
                      i = b;
                      h = g;
                    }
                  }
                  if (h >>> 0 < a >>> 0) fa();
                  else {
                    c[h >> 2] = 0;
                    e = i;
                    break;
                  }
                } else {
                  b = c[(k + 8) >> 2] | 0;
                  if (b >>> 0 < a >>> 0) fa();
                  i = (b + 12) | 0;
                  if ((c[i >> 2] | 0) != (k | 0)) fa();
                  h = (g + 8) | 0;
                  if ((c[h >> 2] | 0) == (k | 0)) {
                    c[i >> 2] = g;
                    c[h >> 2] = b;
                    e = g;
                    break;
                  } else fa();
                }
              while (0);
              do
                if (j) {
                  i = c[(k + 28) >> 2] | 0;
                  h = (360 + (i << 2)) | 0;
                  if ((k | 0) == (c[h >> 2] | 0)) {
                    c[h >> 2] = e;
                    if (!e) {
                      c[15] = c[15] & ~(1 << i);
                      break;
                    }
                  } else {
                    if (j >>> 0 < (c[18] | 0) >>> 0) fa();
                    i = (j + 16) | 0;
                    if ((c[i >> 2] | 0) == (k | 0)) c[i >> 2] = e;
                    else c[(j + 20) >> 2] = e;
                    if (!e) break;
                  }
                  h = c[18] | 0;
                  if (e >>> 0 < h >>> 0) fa();
                  c[(e + 24) >> 2] = j;
                  i = c[(k + 16) >> 2] | 0;
                  do
                    if (i)
                      if (i >>> 0 < h >>> 0) fa();
                      else {
                        c[(e + 16) >> 2] = i;
                        c[(i + 24) >> 2] = e;
                        break;
                      }
                  while (0);
                  i = c[(k + 20) >> 2] | 0;
                  if (i)
                    if (i >>> 0 < (c[18] | 0) >>> 0) fa();
                    else {
                      c[(e + 20) >> 2] = i;
                      c[(i + 24) >> 2] = e;
                      break;
                    }
                }
              while (0);
              if (l >>> 0 < 16) {
                w = (l + q) | 0;
                c[(k + 4) >> 2] = w | 3;
                w = (k + (w + 4)) | 0;
                c[w >> 2] = c[w >> 2] | 1;
              } else {
                c[(k + 4) >> 2] = q | 3;
                c[(k + (q | 4)) >> 2] = l | 1;
                c[(k + (l + q)) >> 2] = l;
                d = c[16] | 0;
                if (d) {
                  e = c[19] | 0;
                  g = d >>> 3;
                  i = g << 1;
                  b = (96 + (i << 2)) | 0;
                  h = c[14] | 0;
                  g = 1 << g;
                  if (h & g) {
                    i = (96 + ((i + 2) << 2)) | 0;
                    h = c[i >> 2] | 0;
                    if (h >>> 0 < (c[18] | 0) >>> 0) fa();
                    else {
                      p = i;
                      o = h;
                    }
                  } else {
                    c[14] = h | g;
                    p = (96 + ((i + 2) << 2)) | 0;
                    o = b;
                  }
                  c[p >> 2] = e;
                  c[(o + 12) >> 2] = e;
                  c[(e + 8) >> 2] = o;
                  c[(e + 12) >> 2] = b;
                }
                c[16] = l;
                c[19] = f;
              }
              w = (k + 8) | 0;
              return w | 0;
            } else z = q;
          } else z = q;
        } else if (a >>> 0 <= 4294967231) {
          a = (a + 11) | 0;
          p = a & -8;
          k = c[15] | 0;
          if (k) {
            j = (0 - p) | 0;
            a = a >>> 8;
            if (a)
              if (p >>> 0 > 16777215) l = 31;
              else {
                q = (((a + 1048320) | 0) >>> 16) & 8;
                w = a << q;
                o = (((w + 520192) | 0) >>> 16) & 4;
                w = w << o;
                l = (((w + 245760) | 0) >>> 16) & 2;
                l = (14 - (o | q | l) + ((w << l) >>> 15)) | 0;
                l = ((p >>> ((l + 7) | 0)) & 1) | (l << 1);
              }
            else l = 0;
            a = c[(360 + (l << 2)) >> 2] | 0;
            a: do
              if (!a) {
                h = 0;
                a = 0;
                w = 86;
              } else {
                d = j;
                h = 0;
                e = p << ((l | 0) == 31 ? 0 : (25 - (l >>> 1)) | 0);
                f = a;
                a = 0;
                while (1) {
                  g = c[(f + 4) >> 2] & -8;
                  j = (g - p) | 0;
                  if (j >>> 0 < d >>> 0)
                    if ((g | 0) == (p | 0)) {
                      g = f;
                      a = f;
                      w = 90;
                      break a;
                    } else a = f;
                  else j = d;
                  w = c[(f + 20) >> 2] | 0;
                  f = c[(f + 16 + ((e >>> 31) << 2)) >> 2] | 0;
                  h = ((w | 0) == 0) | ((w | 0) == (f | 0)) ? h : w;
                  if (!f) {
                    w = 86;
                    break;
                  } else {
                    d = j;
                    e = e << 1;
                  }
                }
              }
            while (0);
            if ((w | 0) == 86) {
              if (((h | 0) == 0) & ((a | 0) == 0)) {
                a = 2 << l;
                a = k & (a | (0 - a));
                if (!a) {
                  z = p;
                  break;
                }
                a = ((a & (0 - a)) + -1) | 0;
                n = (a >>> 12) & 16;
                a = a >>> n;
                m = (a >>> 5) & 8;
                a = a >>> m;
                o = (a >>> 2) & 4;
                a = a >>> o;
                q = (a >>> 1) & 2;
                a = a >>> q;
                h = (a >>> 1) & 1;
                h = c[(360 + (((m | n | o | q | h) + (a >>> h)) << 2)) >> 2] | 0;
                a = 0;
              }
              if (!h) {
                n = j;
                q = a;
              } else {
                g = h;
                w = 90;
              }
            }
            if ((w | 0) == 90)
              while (1) {
                w = 0;
                q = ((c[(g + 4) >> 2] & -8) - p) | 0;
                h = q >>> 0 < j >>> 0;
                j = h ? q : j;
                a = h ? g : a;
                h = c[(g + 16) >> 2] | 0;
                if (h) {
                  g = h;
                  w = 90;
                  continue;
                }
                g = c[(g + 20) >> 2] | 0;
                if (!g) {
                  n = j;
                  q = a;
                  break;
                } else w = 90;
              }
            if ((q | 0) != 0 ? n >>> 0 < (((c[16] | 0) - p) | 0) >>> 0 : 0) {
              a = c[18] | 0;
              if (q >>> 0 < a >>> 0) fa();
              m = (q + p) | 0;
              if (q >>> 0 >= m >>> 0) fa();
              j = c[(q + 24) >> 2] | 0;
              g = c[(q + 12) >> 2] | 0;
              do
                if ((g | 0) == (q | 0)) {
                  h = (q + 20) | 0;
                  i = c[h >> 2] | 0;
                  if (!i) {
                    h = (q + 16) | 0;
                    i = c[h >> 2] | 0;
                    if (!i) {
                      s = 0;
                      break;
                    }
                  }
                  while (1) {
                    g = (i + 20) | 0;
                    b = c[g >> 2] | 0;
                    if (b) {
                      i = b;
                      h = g;
                      continue;
                    }
                    g = (i + 16) | 0;
                    b = c[g >> 2] | 0;
                    if (!b) break;
                    else {
                      i = b;
                      h = g;
                    }
                  }
                  if (h >>> 0 < a >>> 0) fa();
                  else {
                    c[h >> 2] = 0;
                    s = i;
                    break;
                  }
                } else {
                  b = c[(q + 8) >> 2] | 0;
                  if (b >>> 0 < a >>> 0) fa();
                  i = (b + 12) | 0;
                  if ((c[i >> 2] | 0) != (q | 0)) fa();
                  h = (g + 8) | 0;
                  if ((c[h >> 2] | 0) == (q | 0)) {
                    c[i >> 2] = g;
                    c[h >> 2] = b;
                    s = g;
                    break;
                  } else fa();
                }
              while (0);
              do
                if (j) {
                  i = c[(q + 28) >> 2] | 0;
                  h = (360 + (i << 2)) | 0;
                  if ((q | 0) == (c[h >> 2] | 0)) {
                    c[h >> 2] = s;
                    if (!s) {
                      c[15] = c[15] & ~(1 << i);
                      break;
                    }
                  } else {
                    if (j >>> 0 < (c[18] | 0) >>> 0) fa();
                    i = (j + 16) | 0;
                    if ((c[i >> 2] | 0) == (q | 0)) c[i >> 2] = s;
                    else c[(j + 20) >> 2] = s;
                    if (!s) break;
                  }
                  h = c[18] | 0;
                  if (s >>> 0 < h >>> 0) fa();
                  c[(s + 24) >> 2] = j;
                  i = c[(q + 16) >> 2] | 0;
                  do
                    if (i)
                      if (i >>> 0 < h >>> 0) fa();
                      else {
                        c[(s + 16) >> 2] = i;
                        c[(i + 24) >> 2] = s;
                        break;
                      }
                  while (0);
                  i = c[(q + 20) >> 2] | 0;
                  if (i)
                    if (i >>> 0 < (c[18] | 0) >>> 0) fa();
                    else {
                      c[(s + 20) >> 2] = i;
                      c[(i + 24) >> 2] = s;
                      break;
                    }
                }
              while (0);
              b: do
                if (n >>> 0 >= 16) {
                  c[(q + 4) >> 2] = p | 3;
                  c[(q + (p | 4)) >> 2] = n | 1;
                  c[(q + (n + p)) >> 2] = n;
                  i = n >>> 3;
                  if (n >>> 0 < 256) {
                    h = i << 1;
                    b = (96 + (h << 2)) | 0;
                    g = c[14] | 0;
                    i = 1 << i;
                    if (g & i) {
                      i = (96 + ((h + 2) << 2)) | 0;
                      h = c[i >> 2] | 0;
                      if (h >>> 0 < (c[18] | 0) >>> 0) fa();
                      else {
                        t = i;
                        u = h;
                      }
                    } else {
                      c[14] = g | i;
                      t = (96 + ((h + 2) << 2)) | 0;
                      u = b;
                    }
                    c[t >> 2] = m;
                    c[(u + 12) >> 2] = m;
                    c[(q + (p + 8)) >> 2] = u;
                    c[(q + (p + 12)) >> 2] = b;
                    break;
                  }
                  d = n >>> 8;
                  if (d)
                    if (n >>> 0 > 16777215) b = 31;
                    else {
                      v = (((d + 1048320) | 0) >>> 16) & 8;
                      w = d << v;
                      u = (((w + 520192) | 0) >>> 16) & 4;
                      w = w << u;
                      b = (((w + 245760) | 0) >>> 16) & 2;
                      b = (14 - (u | v | b) + ((w << b) >>> 15)) | 0;
                      b = ((n >>> ((b + 7) | 0)) & 1) | (b << 1);
                    }
                  else b = 0;
                  i = (360 + (b << 2)) | 0;
                  c[(q + (p + 28)) >> 2] = b;
                  c[(q + (p + 20)) >> 2] = 0;
                  c[(q + (p + 16)) >> 2] = 0;
                  h = c[15] | 0;
                  g = 1 << b;
                  if (!(h & g)) {
                    c[15] = h | g;
                    c[i >> 2] = m;
                    c[(q + (p + 24)) >> 2] = i;
                    c[(q + (p + 12)) >> 2] = m;
                    c[(q + (p + 8)) >> 2] = m;
                    break;
                  }
                  d = c[i >> 2] | 0;
                  c: do
                    if (((c[(d + 4) >> 2] & -8) | 0) != (n | 0)) {
                      h = n << ((b | 0) == 31 ? 0 : (25 - (b >>> 1)) | 0);
                      while (1) {
                        b = (d + 16 + ((h >>> 31) << 2)) | 0;
                        i = c[b >> 2] | 0;
                        if (!i) break;
                        if (((c[(i + 4) >> 2] & -8) | 0) == (n | 0)) {
                          z = i;
                          break c;
                        } else {
                          h = h << 1;
                          d = i;
                        }
                      }
                      if (b >>> 0 < (c[18] | 0) >>> 0) fa();
                      else {
                        c[b >> 2] = m;
                        c[(q + (p + 24)) >> 2] = d;
                        c[(q + (p + 12)) >> 2] = m;
                        c[(q + (p + 8)) >> 2] = m;
                        break b;
                      }
                    } else z = d;
                  while (0);
                  d = (z + 8) | 0;
                  b = c[d >> 2] | 0;
                  w = c[18] | 0;
                  if ((b >>> 0 >= w >>> 0) & (z >>> 0 >= w >>> 0)) {
                    c[(b + 12) >> 2] = m;
                    c[d >> 2] = m;
                    c[(q + (p + 8)) >> 2] = b;
                    c[(q + (p + 12)) >> 2] = z;
                    c[(q + (p + 24)) >> 2] = 0;
                    break;
                  } else fa();
                } else {
                  w = (n + p) | 0;
                  c[(q + 4) >> 2] = w | 3;
                  w = (q + (w + 4)) | 0;
                  c[w >> 2] = c[w >> 2] | 1;
                }
              while (0);
              w = (q + 8) | 0;
              return w | 0;
            } else z = p;
          } else z = p;
        } else z = -1;
      while (0);
      a = c[16] | 0;
      if (a >>> 0 >= z >>> 0) {
        b = (a - z) | 0;
        d = c[19] | 0;
        if (b >>> 0 > 15) {
          c[19] = d + z;
          c[16] = b;
          c[(d + (z + 4)) >> 2] = b | 1;
          c[(d + a) >> 2] = b;
          c[(d + 4) >> 2] = z | 3;
        } else {
          c[16] = 0;
          c[19] = 0;
          c[(d + 4) >> 2] = a | 3;
          w = (d + (a + 4)) | 0;
          c[w >> 2] = c[w >> 2] | 1;
        }
        w = (d + 8) | 0;
        return w | 0;
      }
      a = c[17] | 0;
      if (a >>> 0 > z >>> 0) {
        v = (a - z) | 0;
        c[17] = v;
        w = c[20] | 0;
        c[20] = w + z;
        c[(w + (z + 4)) >> 2] = v | 1;
        c[(w + 4) >> 2] = z | 3;
        w = (w + 8) | 0;
        return w | 0;
      }
      do
        if (!(c[132] | 0)) {
          a = ma(30) | 0;
          if (!((a + -1) & a)) {
            c[134] = a;
            c[133] = a;
            c[135] = -1;
            c[136] = -1;
            c[137] = 0;
            c[125] = 0;
            c[132] = ((ja(0) | 0) & -16) ^ 1431655768;
            break;
          } else fa();
        }
      while (0);
      l = (z + 48) | 0;
      e = c[134] | 0;
      f = (z + 47) | 0;
      d = (e + f) | 0;
      e = (0 - e) | 0;
      m = d & e;
      if (m >>> 0 <= z >>> 0) {
        w = 0;
        return w | 0;
      }
      a = c[124] | 0;
      if ((a | 0) != 0 ? ((t = c[122] | 0), (u = (t + m) | 0), (u >>> 0 <= t >>> 0) | (u >>> 0 > a >>> 0)) : 0) {
        w = 0;
        return w | 0;
      }
      d: do
        if (!(c[125] & 4)) {
          a = c[20] | 0;
          e: do
            if (a) {
              h = 504;
              while (1) {
                j = c[h >> 2] | 0;
                if (j >>> 0 <= a >>> 0 ? ((r = (h + 4) | 0), ((j + (c[r >> 2] | 0)) | 0) >>> 0 > a >>> 0) : 0) {
                  g = h;
                  a = r;
                  break;
                }
                h = c[(h + 8) >> 2] | 0;
                if (!h) {
                  w = 174;
                  break e;
                }
              }
              j = (d - (c[17] | 0)) & e;
              if (j >>> 0 < 2147483647) {
                h = ia(j | 0) | 0;
                u = (h | 0) == (((c[g >> 2] | 0) + (c[a >> 2] | 0)) | 0);
                a = u ? j : 0;
                if (u) {
                  if ((h | 0) != (-1 | 0)) {
                    x = h;
                    w = 194;
                    break d;
                  }
                } else w = 184;
              } else a = 0;
            } else w = 174;
          while (0);
          do
            if ((w | 0) == 174) {
              g = ia(0) | 0;
              if ((g | 0) != (-1 | 0)) {
                a = g;
                j = c[133] | 0;
                h = (j + -1) | 0;
                if (!(h & a)) j = m;
                else j = (m - a + ((h + a) & (0 - j))) | 0;
                a = c[122] | 0;
                h = (a + j) | 0;
                if ((j >>> 0 > z >>> 0) & (j >>> 0 < 2147483647)) {
                  u = c[124] | 0;
                  if ((u | 0) != 0 ? (h >>> 0 <= a >>> 0) | (h >>> 0 > u >>> 0) : 0) {
                    a = 0;
                    break;
                  }
                  h = ia(j | 0) | 0;
                  w = (h | 0) == (g | 0);
                  a = w ? j : 0;
                  if (w) {
                    x = g;
                    w = 194;
                    break d;
                  } else w = 184;
                } else a = 0;
              } else a = 0;
            }
          while (0);
          f: do
            if ((w | 0) == 184) {
              g = (0 - j) | 0;
              do
                if (
                  (l >>> 0 > j >>> 0) & ((j >>> 0 < 2147483647) & ((h | 0) != (-1 | 0)))
                    ? ((v = c[134] | 0), (v = (f - j + v) & (0 - v)), v >>> 0 < 2147483647)
                    : 0
                )
                  if ((ia(v | 0) | 0) == (-1 | 0)) {
                    ia(g | 0) | 0;
                    break f;
                  } else {
                    j = (v + j) | 0;
                    break;
                  }
              while (0);
              if ((h | 0) != (-1 | 0)) {
                x = h;
                a = j;
                w = 194;
                break d;
              }
            }
          while (0);
          c[125] = c[125] | 4;
          w = 191;
        } else {
          a = 0;
          w = 191;
        }
      while (0);
      if (
        (
          ((w | 0) == 191 ? m >>> 0 < 2147483647 : 0)
            ? ((x = ia(m | 0) | 0),
              (y = ia(0) | 0),
              (x >>> 0 < y >>> 0) & (((x | 0) != (-1 | 0)) & ((y | 0) != (-1 | 0))))
            : 0
        )
          ? ((A = (y - x) | 0), (B = A >>> 0 > ((z + 40) | 0) >>> 0), B)
          : 0
      ) {
        a = B ? A : a;
        w = 194;
      }
      if ((w | 0) == 194) {
        j = ((c[122] | 0) + a) | 0;
        c[122] = j;
        if (j >>> 0 > (c[123] | 0) >>> 0) c[123] = j;
        n = c[20] | 0;
        g: do
          if (n) {
            d = 504;
            do {
              j = c[d >> 2] | 0;
              h = (d + 4) | 0;
              g = c[h >> 2] | 0;
              if ((x | 0) == ((j + g) | 0)) {
                C = j;
                D = h;
                E = g;
                F = d;
                w = 204;
                break;
              }
              d = c[(d + 8) >> 2] | 0;
            } while ((d | 0) != 0);
            if (
              ((w | 0) == 204 ? ((c[(F + 12) >> 2] & 8) | 0) == 0 : 0) ? (n >>> 0 < x >>> 0) & (n >>> 0 >= C >>> 0) : 0
            ) {
              c[D >> 2] = E + a;
              w = ((c[17] | 0) + a) | 0;
              v = (n + 8) | 0;
              v = ((v & 7) | 0) == 0 ? 0 : (0 - v) & 7;
              u = (w - v) | 0;
              c[20] = n + v;
              c[17] = u;
              c[(n + (v + 4)) >> 2] = u | 1;
              c[(n + (w + 4)) >> 2] = 40;
              c[21] = c[136];
              break;
            }
            j = c[18] | 0;
            if (x >>> 0 < j >>> 0) {
              c[18] = x;
              j = x;
            }
            h = (x + a) | 0;
            d = 504;
            while (1) {
              if ((c[d >> 2] | 0) == (h | 0)) {
                g = d;
                h = d;
                w = 212;
                break;
              }
              d = c[(d + 8) >> 2] | 0;
              if (!d) {
                g = 504;
                break;
              }
            }
            if ((w | 0) == 212)
              if (!(c[(h + 12) >> 2] & 8)) {
                c[g >> 2] = x;
                p = (h + 4) | 0;
                c[p >> 2] = (c[p >> 2] | 0) + a;
                p = (x + 8) | 0;
                p = ((p & 7) | 0) == 0 ? 0 : (0 - p) & 7;
                k = (x + (a + 8)) | 0;
                k = ((k & 7) | 0) == 0 ? 0 : (0 - k) & 7;
                i = (x + (k + a)) | 0;
                o = (p + z) | 0;
                q = (x + o) | 0;
                m = (i - (x + p) - z) | 0;
                c[(x + (p + 4)) >> 2] = z | 3;
                h: do
                  if ((i | 0) != (n | 0)) {
                    if ((i | 0) == (c[19] | 0)) {
                      w = ((c[16] | 0) + m) | 0;
                      c[16] = w;
                      c[19] = q;
                      c[(x + (o + 4)) >> 2] = w | 1;
                      c[(x + (w + o)) >> 2] = w;
                      break;
                    }
                    l = (a + 4) | 0;
                    h = c[(x + (l + k)) >> 2] | 0;
                    if (((h & 3) | 0) == 1) {
                      f = h & -8;
                      d = h >>> 3;
                      i: do
                        if (h >>> 0 >= 256) {
                          e = c[(x + ((k | 24) + a)) >> 2] | 0;
                          g = c[(x + (a + 12 + k)) >> 2] | 0;
                          do
                            if ((g | 0) == (i | 0)) {
                              b = k | 16;
                              g = (x + (l + b)) | 0;
                              h = c[g >> 2] | 0;
                              if (!h) {
                                g = (x + (b + a)) | 0;
                                h = c[g >> 2] | 0;
                                if (!h) {
                                  K = 0;
                                  break;
                                }
                              }
                              while (1) {
                                b = (h + 20) | 0;
                                d = c[b >> 2] | 0;
                                if (d) {
                                  h = d;
                                  g = b;
                                  continue;
                                }
                                b = (h + 16) | 0;
                                d = c[b >> 2] | 0;
                                if (!d) break;
                                else {
                                  h = d;
                                  g = b;
                                }
                              }
                              if (g >>> 0 < j >>> 0) fa();
                              else {
                                c[g >> 2] = 0;
                                K = h;
                                break;
                              }
                            } else {
                              b = c[(x + ((k | 8) + a)) >> 2] | 0;
                              if (b >>> 0 < j >>> 0) fa();
                              j = (b + 12) | 0;
                              if ((c[j >> 2] | 0) != (i | 0)) fa();
                              h = (g + 8) | 0;
                              if ((c[h >> 2] | 0) == (i | 0)) {
                                c[j >> 2] = g;
                                c[h >> 2] = b;
                                K = g;
                                break;
                              } else fa();
                            }
                          while (0);
                          if (!e) break;
                          j = c[(x + (a + 28 + k)) >> 2] | 0;
                          h = (360 + (j << 2)) | 0;
                          do
                            if ((i | 0) != (c[h >> 2] | 0)) {
                              if (e >>> 0 < (c[18] | 0) >>> 0) fa();
                              j = (e + 16) | 0;
                              if ((c[j >> 2] | 0) == (i | 0)) c[j >> 2] = K;
                              else c[(e + 20) >> 2] = K;
                              if (!K) break i;
                            } else {
                              c[h >> 2] = K;
                              if (K) break;
                              c[15] = c[15] & ~(1 << j);
                              break i;
                            }
                          while (0);
                          h = c[18] | 0;
                          if (K >>> 0 < h >>> 0) fa();
                          c[(K + 24) >> 2] = e;
                          j = k | 16;
                          i = c[(x + (j + a)) >> 2] | 0;
                          do
                            if (i)
                              if (i >>> 0 < h >>> 0) fa();
                              else {
                                c[(K + 16) >> 2] = i;
                                c[(i + 24) >> 2] = K;
                                break;
                              }
                          while (0);
                          i = c[(x + (l + j)) >> 2] | 0;
                          if (!i) break;
                          if (i >>> 0 < (c[18] | 0) >>> 0) fa();
                          else {
                            c[(K + 20) >> 2] = i;
                            c[(i + 24) >> 2] = K;
                            break;
                          }
                        } else {
                          g = c[(x + ((k | 8) + a)) >> 2] | 0;
                          b = c[(x + (a + 12 + k)) >> 2] | 0;
                          h = (96 + ((d << 1) << 2)) | 0;
                          do
                            if ((g | 0) != (h | 0)) {
                              if (g >>> 0 < j >>> 0) fa();
                              if ((c[(g + 12) >> 2] | 0) == (i | 0)) break;
                              fa();
                            }
                          while (0);
                          if ((b | 0) == (g | 0)) {
                            c[14] = c[14] & ~(1 << d);
                            break;
                          }
                          do
                            if ((b | 0) == (h | 0)) G = (b + 8) | 0;
                            else {
                              if (b >>> 0 < j >>> 0) fa();
                              j = (b + 8) | 0;
                              if ((c[j >> 2] | 0) == (i | 0)) {
                                G = j;
                                break;
                              }
                              fa();
                            }
                          while (0);
                          c[(g + 12) >> 2] = b;
                          c[G >> 2] = g;
                        }
                      while (0);
                      i = (x + ((f | k) + a)) | 0;
                      j = (f + m) | 0;
                    } else j = m;
                    i = (i + 4) | 0;
                    c[i >> 2] = c[i >> 2] & -2;
                    c[(x + (o + 4)) >> 2] = j | 1;
                    c[(x + (j + o)) >> 2] = j;
                    i = j >>> 3;
                    if (j >>> 0 < 256) {
                      h = i << 1;
                      b = (96 + (h << 2)) | 0;
                      g = c[14] | 0;
                      i = 1 << i;
                      do
                        if (!(g & i)) {
                          c[14] = g | i;
                          L = (96 + ((h + 2) << 2)) | 0;
                          M = b;
                        } else {
                          i = (96 + ((h + 2) << 2)) | 0;
                          h = c[i >> 2] | 0;
                          if (h >>> 0 >= (c[18] | 0) >>> 0) {
                            L = i;
                            M = h;
                            break;
                          }
                          fa();
                        }
                      while (0);
                      c[L >> 2] = q;
                      c[(M + 12) >> 2] = q;
                      c[(x + (o + 8)) >> 2] = M;
                      c[(x + (o + 12)) >> 2] = b;
                      break;
                    }
                    d = j >>> 8;
                    do
                      if (!d) b = 0;
                      else {
                        if (j >>> 0 > 16777215) {
                          b = 31;
                          break;
                        }
                        v = (((d + 1048320) | 0) >>> 16) & 8;
                        w = d << v;
                        u = (((w + 520192) | 0) >>> 16) & 4;
                        w = w << u;
                        b = (((w + 245760) | 0) >>> 16) & 2;
                        b = (14 - (u | v | b) + ((w << b) >>> 15)) | 0;
                        b = ((j >>> ((b + 7) | 0)) & 1) | (b << 1);
                      }
                    while (0);
                    i = (360 + (b << 2)) | 0;
                    c[(x + (o + 28)) >> 2] = b;
                    c[(x + (o + 20)) >> 2] = 0;
                    c[(x + (o + 16)) >> 2] = 0;
                    h = c[15] | 0;
                    g = 1 << b;
                    if (!(h & g)) {
                      c[15] = h | g;
                      c[i >> 2] = q;
                      c[(x + (o + 24)) >> 2] = i;
                      c[(x + (o + 12)) >> 2] = q;
                      c[(x + (o + 8)) >> 2] = q;
                      break;
                    }
                    d = c[i >> 2] | 0;
                    j: do
                      if (((c[(d + 4) >> 2] & -8) | 0) != (j | 0)) {
                        h = j << ((b | 0) == 31 ? 0 : (25 - (b >>> 1)) | 0);
                        while (1) {
                          b = (d + 16 + ((h >>> 31) << 2)) | 0;
                          i = c[b >> 2] | 0;
                          if (!i) break;
                          if (((c[(i + 4) >> 2] & -8) | 0) == (j | 0)) {
                            N = i;
                            break j;
                          } else {
                            h = h << 1;
                            d = i;
                          }
                        }
                        if (b >>> 0 < (c[18] | 0) >>> 0) fa();
                        else {
                          c[b >> 2] = q;
                          c[(x + (o + 24)) >> 2] = d;
                          c[(x + (o + 12)) >> 2] = q;
                          c[(x + (o + 8)) >> 2] = q;
                          break h;
                        }
                      } else N = d;
                    while (0);
                    d = (N + 8) | 0;
                    b = c[d >> 2] | 0;
                    w = c[18] | 0;
                    if ((b >>> 0 >= w >>> 0) & (N >>> 0 >= w >>> 0)) {
                      c[(b + 12) >> 2] = q;
                      c[d >> 2] = q;
                      c[(x + (o + 8)) >> 2] = b;
                      c[(x + (o + 12)) >> 2] = N;
                      c[(x + (o + 24)) >> 2] = 0;
                      break;
                    } else fa();
                  } else {
                    w = ((c[17] | 0) + m) | 0;
                    c[17] = w;
                    c[20] = q;
                    c[(x + (o + 4)) >> 2] = w | 1;
                  }
                while (0);
                w = (x + (p | 8)) | 0;
                return w | 0;
              } else g = 504;
            while (1) {
              h = c[g >> 2] | 0;
              if (h >>> 0 <= n >>> 0 ? ((i = c[(g + 4) >> 2] | 0), (b = (h + i) | 0), b >>> 0 > n >>> 0) : 0) break;
              g = c[(g + 8) >> 2] | 0;
            }
            j = (h + (i + -39)) | 0;
            h = (h + (i + -47 + (((j & 7) | 0) == 0 ? 0 : (0 - j) & 7))) | 0;
            j = (n + 16) | 0;
            h = h >>> 0 < j >>> 0 ? n : h;
            i = (h + 8) | 0;
            g = (x + 8) | 0;
            g = ((g & 7) | 0) == 0 ? 0 : (0 - g) & 7;
            w = (a + -40 - g) | 0;
            c[20] = x + g;
            c[17] = w;
            c[(x + (g + 4)) >> 2] = w | 1;
            c[(x + (a + -36)) >> 2] = 40;
            c[21] = c[136];
            g = (h + 4) | 0;
            c[g >> 2] = 27;
            c[i >> 2] = c[126];
            c[(i + 4) >> 2] = c[127];
            c[(i + 8) >> 2] = c[128];
            c[(i + 12) >> 2] = c[129];
            c[126] = x;
            c[127] = a;
            c[129] = 0;
            c[128] = i;
            i = (h + 28) | 0;
            c[i >> 2] = 7;
            if (((h + 32) | 0) >>> 0 < b >>> 0)
              do {
                w = i;
                i = (i + 4) | 0;
                c[i >> 2] = 7;
              } while (((w + 8) | 0) >>> 0 < b >>> 0);
            if ((h | 0) != (n | 0)) {
              f = (h - n) | 0;
              c[g >> 2] = c[g >> 2] & -2;
              c[(n + 4) >> 2] = f | 1;
              c[h >> 2] = f;
              i = f >>> 3;
              if (f >>> 0 < 256) {
                h = i << 1;
                e = (96 + (h << 2)) | 0;
                g = c[14] | 0;
                i = 1 << i;
                if (g & i) {
                  d = (96 + ((h + 2) << 2)) | 0;
                  b = c[d >> 2] | 0;
                  if (b >>> 0 < (c[18] | 0) >>> 0) fa();
                  else {
                    H = d;
                    I = b;
                  }
                } else {
                  c[14] = g | i;
                  H = (96 + ((h + 2) << 2)) | 0;
                  I = e;
                }
                c[H >> 2] = n;
                c[(I + 12) >> 2] = n;
                c[(n + 8) >> 2] = I;
                c[(n + 12) >> 2] = e;
                break;
              }
              d = f >>> 8;
              if (d)
                if (f >>> 0 > 16777215) h = 31;
                else {
                  v = (((d + 1048320) | 0) >>> 16) & 8;
                  w = d << v;
                  u = (((w + 520192) | 0) >>> 16) & 4;
                  w = w << u;
                  h = (((w + 245760) | 0) >>> 16) & 2;
                  h = (14 - (u | v | h) + ((w << h) >>> 15)) | 0;
                  h = ((f >>> ((h + 7) | 0)) & 1) | (h << 1);
                }
              else h = 0;
              i = (360 + (h << 2)) | 0;
              c[(n + 28) >> 2] = h;
              c[(n + 20) >> 2] = 0;
              c[j >> 2] = 0;
              d = c[15] | 0;
              b = 1 << h;
              if (!(d & b)) {
                c[15] = d | b;
                c[i >> 2] = n;
                c[(n + 24) >> 2] = i;
                c[(n + 12) >> 2] = n;
                c[(n + 8) >> 2] = n;
                break;
              }
              d = c[i >> 2] | 0;
              k: do
                if (((c[(d + 4) >> 2] & -8) | 0) != (f | 0)) {
                  i = f << ((h | 0) == 31 ? 0 : (25 - (h >>> 1)) | 0);
                  while (1) {
                    b = (d + 16 + ((i >>> 31) << 2)) | 0;
                    e = c[b >> 2] | 0;
                    if (!e) break;
                    if (((c[(e + 4) >> 2] & -8) | 0) == (f | 0)) {
                      J = e;
                      break k;
                    } else {
                      i = i << 1;
                      d = e;
                    }
                  }
                  if (b >>> 0 < (c[18] | 0) >>> 0) fa();
                  else {
                    c[b >> 2] = n;
                    c[(n + 24) >> 2] = d;
                    c[(n + 12) >> 2] = n;
                    c[(n + 8) >> 2] = n;
                    break g;
                  }
                } else J = d;
              while (0);
              d = (J + 8) | 0;
              b = c[d >> 2] | 0;
              w = c[18] | 0;
              if ((b >>> 0 >= w >>> 0) & (J >>> 0 >= w >>> 0)) {
                c[(b + 12) >> 2] = n;
                c[d >> 2] = n;
                c[(n + 8) >> 2] = b;
                c[(n + 12) >> 2] = J;
                c[(n + 24) >> 2] = 0;
                break;
              } else fa();
            }
          } else {
            w = c[18] | 0;
            if (((w | 0) == 0) | (x >>> 0 < w >>> 0)) c[18] = x;
            c[126] = x;
            c[127] = a;
            c[129] = 0;
            c[23] = c[132];
            c[22] = -1;
            d = 0;
            do {
              w = d << 1;
              v = (96 + (w << 2)) | 0;
              c[(96 + ((w + 3) << 2)) >> 2] = v;
              c[(96 + ((w + 2) << 2)) >> 2] = v;
              d = (d + 1) | 0;
            } while ((d | 0) != 32);
            w = (x + 8) | 0;
            w = ((w & 7) | 0) == 0 ? 0 : (0 - w) & 7;
            v = (a + -40 - w) | 0;
            c[20] = x + w;
            c[17] = v;
            c[(x + (w + 4)) >> 2] = v | 1;
            c[(x + (a + -36)) >> 2] = 40;
            c[21] = c[136];
          }
        while (0);
        b = c[17] | 0;
        if (b >>> 0 > z >>> 0) {
          v = (b - z) | 0;
          c[17] = v;
          w = c[20] | 0;
          c[20] = w + z;
          c[(w + (z + 4)) >> 2] = v | 1;
          c[(w + 4) >> 2] = z | 3;
          w = (w + 8) | 0;
          return w | 0;
        }
      }
      c[(ya() | 0) >> 2] = 12;
      w = 0;
      return w | 0;
    }
    function Aa(a) {
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
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0,
        s = 0,
        t = 0,
        u = 0;
      if (!a) return;
      g = (a + -8) | 0;
      h = c[18] | 0;
      if (g >>> 0 < h >>> 0) fa();
      b = c[(a + -4) >> 2] | 0;
      d = b & 3;
      if ((d | 0) == 1) fa();
      o = b & -8;
      q = (a + (o + -8)) | 0;
      do
        if (!(b & 1)) {
          g = c[g >> 2] | 0;
          if (!d) return;
          i = (-8 - g) | 0;
          l = (a + i) | 0;
          m = (g + o) | 0;
          if (l >>> 0 < h >>> 0) fa();
          if ((l | 0) == (c[19] | 0)) {
            g = (a + (o + -4)) | 0;
            b = c[g >> 2] | 0;
            if (((b & 3) | 0) != 3) {
              u = l;
              k = m;
              break;
            }
            c[16] = m;
            c[g >> 2] = b & -2;
            c[(a + (i + 4)) >> 2] = m | 1;
            c[q >> 2] = m;
            return;
          }
          e = g >>> 3;
          if (g >>> 0 < 256) {
            d = c[(a + (i + 8)) >> 2] | 0;
            b = c[(a + (i + 12)) >> 2] | 0;
            g = (96 + ((e << 1) << 2)) | 0;
            if ((d | 0) != (g | 0)) {
              if (d >>> 0 < h >>> 0) fa();
              if ((c[(d + 12) >> 2] | 0) != (l | 0)) fa();
            }
            if ((b | 0) == (d | 0)) {
              c[14] = c[14] & ~(1 << e);
              u = l;
              k = m;
              break;
            }
            if ((b | 0) != (g | 0)) {
              if (b >>> 0 < h >>> 0) fa();
              g = (b + 8) | 0;
              if ((c[g >> 2] | 0) == (l | 0)) f = g;
              else fa();
            } else f = (b + 8) | 0;
            c[(d + 12) >> 2] = b;
            c[f >> 2] = d;
            u = l;
            k = m;
            break;
          }
          f = c[(a + (i + 24)) >> 2] | 0;
          d = c[(a + (i + 12)) >> 2] | 0;
          do
            if ((d | 0) == (l | 0)) {
              b = (a + (i + 20)) | 0;
              g = c[b >> 2] | 0;
              if (!g) {
                b = (a + (i + 16)) | 0;
                g = c[b >> 2] | 0;
                if (!g) {
                  j = 0;
                  break;
                }
              }
              while (1) {
                d = (g + 20) | 0;
                e = c[d >> 2] | 0;
                if (e) {
                  g = e;
                  b = d;
                  continue;
                }
                d = (g + 16) | 0;
                e = c[d >> 2] | 0;
                if (!e) break;
                else {
                  g = e;
                  b = d;
                }
              }
              if (b >>> 0 < h >>> 0) fa();
              else {
                c[b >> 2] = 0;
                j = g;
                break;
              }
            } else {
              e = c[(a + (i + 8)) >> 2] | 0;
              if (e >>> 0 < h >>> 0) fa();
              g = (e + 12) | 0;
              if ((c[g >> 2] | 0) != (l | 0)) fa();
              b = (d + 8) | 0;
              if ((c[b >> 2] | 0) == (l | 0)) {
                c[g >> 2] = d;
                c[b >> 2] = e;
                j = d;
                break;
              } else fa();
            }
          while (0);
          if (f) {
            g = c[(a + (i + 28)) >> 2] | 0;
            b = (360 + (g << 2)) | 0;
            if ((l | 0) == (c[b >> 2] | 0)) {
              c[b >> 2] = j;
              if (!j) {
                c[15] = c[15] & ~(1 << g);
                u = l;
                k = m;
                break;
              }
            } else {
              if (f >>> 0 < (c[18] | 0) >>> 0) fa();
              g = (f + 16) | 0;
              if ((c[g >> 2] | 0) == (l | 0)) c[g >> 2] = j;
              else c[(f + 20) >> 2] = j;
              if (!j) {
                u = l;
                k = m;
                break;
              }
            }
            b = c[18] | 0;
            if (j >>> 0 < b >>> 0) fa();
            c[(j + 24) >> 2] = f;
            g = c[(a + (i + 16)) >> 2] | 0;
            do
              if (g)
                if (g >>> 0 < b >>> 0) fa();
                else {
                  c[(j + 16) >> 2] = g;
                  c[(g + 24) >> 2] = j;
                  break;
                }
            while (0);
            g = c[(a + (i + 20)) >> 2] | 0;
            if (g)
              if (g >>> 0 < (c[18] | 0) >>> 0) fa();
              else {
                c[(j + 20) >> 2] = g;
                c[(g + 24) >> 2] = j;
                u = l;
                k = m;
                break;
              }
            else {
              u = l;
              k = m;
            }
          } else {
            u = l;
            k = m;
          }
        } else {
          u = g;
          k = o;
        }
      while (0);
      if (u >>> 0 >= q >>> 0) fa();
      g = (a + (o + -4)) | 0;
      b = c[g >> 2] | 0;
      if (!(b & 1)) fa();
      if (!(b & 2)) {
        if ((q | 0) == (c[20] | 0)) {
          l = ((c[17] | 0) + k) | 0;
          c[17] = l;
          c[20] = u;
          c[(u + 4) >> 2] = l | 1;
          if ((u | 0) != (c[19] | 0)) return;
          c[19] = 0;
          c[16] = 0;
          return;
        }
        if ((q | 0) == (c[19] | 0)) {
          l = ((c[16] | 0) + k) | 0;
          c[16] = l;
          c[19] = u;
          c[(u + 4) >> 2] = l | 1;
          c[(u + l) >> 2] = l;
          return;
        }
        h = ((b & -8) + k) | 0;
        e = b >>> 3;
        do
          if (b >>> 0 >= 256) {
            f = c[(a + (o + 16)) >> 2] | 0;
            g = c[(a + (o | 4)) >> 2] | 0;
            do
              if ((g | 0) == (q | 0)) {
                b = (a + (o + 12)) | 0;
                g = c[b >> 2] | 0;
                if (!g) {
                  b = (a + (o + 8)) | 0;
                  g = c[b >> 2] | 0;
                  if (!g) {
                    p = 0;
                    break;
                  }
                }
                while (1) {
                  d = (g + 20) | 0;
                  e = c[d >> 2] | 0;
                  if (e) {
                    g = e;
                    b = d;
                    continue;
                  }
                  d = (g + 16) | 0;
                  e = c[d >> 2] | 0;
                  if (!e) break;
                  else {
                    g = e;
                    b = d;
                  }
                }
                if (b >>> 0 < (c[18] | 0) >>> 0) fa();
                else {
                  c[b >> 2] = 0;
                  p = g;
                  break;
                }
              } else {
                b = c[(a + o) >> 2] | 0;
                if (b >>> 0 < (c[18] | 0) >>> 0) fa();
                d = (b + 12) | 0;
                if ((c[d >> 2] | 0) != (q | 0)) fa();
                e = (g + 8) | 0;
                if ((c[e >> 2] | 0) == (q | 0)) {
                  c[d >> 2] = g;
                  c[e >> 2] = b;
                  p = g;
                  break;
                } else fa();
              }
            while (0);
            if (f) {
              g = c[(a + (o + 20)) >> 2] | 0;
              b = (360 + (g << 2)) | 0;
              if ((q | 0) == (c[b >> 2] | 0)) {
                c[b >> 2] = p;
                if (!p) {
                  c[15] = c[15] & ~(1 << g);
                  break;
                }
              } else {
                if (f >>> 0 < (c[18] | 0) >>> 0) fa();
                g = (f + 16) | 0;
                if ((c[g >> 2] | 0) == (q | 0)) c[g >> 2] = p;
                else c[(f + 20) >> 2] = p;
                if (!p) break;
              }
              g = c[18] | 0;
              if (p >>> 0 < g >>> 0) fa();
              c[(p + 24) >> 2] = f;
              f = c[(a + (o + 8)) >> 2] | 0;
              do
                if (f)
                  if (f >>> 0 < g >>> 0) fa();
                  else {
                    c[(p + 16) >> 2] = f;
                    c[(f + 24) >> 2] = p;
                    break;
                  }
              while (0);
              d = c[(a + (o + 12)) >> 2] | 0;
              if (d)
                if (d >>> 0 < (c[18] | 0) >>> 0) fa();
                else {
                  c[(p + 20) >> 2] = d;
                  c[(d + 24) >> 2] = p;
                  break;
                }
            }
          } else {
            d = c[(a + o) >> 2] | 0;
            b = c[(a + (o | 4)) >> 2] | 0;
            g = (96 + ((e << 1) << 2)) | 0;
            if ((d | 0) != (g | 0)) {
              if (d >>> 0 < (c[18] | 0) >>> 0) fa();
              if ((c[(d + 12) >> 2] | 0) != (q | 0)) fa();
            }
            if ((b | 0) == (d | 0)) {
              c[14] = c[14] & ~(1 << e);
              break;
            }
            if ((b | 0) != (g | 0)) {
              if (b >>> 0 < (c[18] | 0) >>> 0) fa();
              f = (b + 8) | 0;
              if ((c[f >> 2] | 0) == (q | 0)) n = f;
              else fa();
            } else n = (b + 8) | 0;
            c[(d + 12) >> 2] = b;
            c[n >> 2] = d;
          }
        while (0);
        c[(u + 4) >> 2] = h | 1;
        c[(u + h) >> 2] = h;
        if ((u | 0) == (c[19] | 0)) {
          c[16] = h;
          return;
        } else g = h;
      } else {
        c[g >> 2] = b & -2;
        c[(u + 4) >> 2] = k | 1;
        c[(u + k) >> 2] = k;
        g = k;
      }
      f = g >>> 3;
      if (g >>> 0 < 256) {
        e = f << 1;
        g = (96 + (e << 2)) | 0;
        b = c[14] | 0;
        d = 1 << f;
        if (b & d) {
          d = (96 + ((e + 2) << 2)) | 0;
          b = c[d >> 2] | 0;
          if (b >>> 0 < (c[18] | 0) >>> 0) fa();
          else {
            r = d;
            s = b;
          }
        } else {
          c[14] = b | d;
          r = (96 + ((e + 2) << 2)) | 0;
          s = g;
        }
        c[r >> 2] = u;
        c[(s + 12) >> 2] = u;
        c[(u + 8) >> 2] = s;
        c[(u + 12) >> 2] = g;
        return;
      }
      b = g >>> 8;
      if (b)
        if (g >>> 0 > 16777215) f = 31;
        else {
          k = (((b + 1048320) | 0) >>> 16) & 8;
          l = b << k;
          j = (((l + 520192) | 0) >>> 16) & 4;
          l = l << j;
          f = (((l + 245760) | 0) >>> 16) & 2;
          f = (14 - (j | k | f) + ((l << f) >>> 15)) | 0;
          f = ((g >>> ((f + 7) | 0)) & 1) | (f << 1);
        }
      else f = 0;
      d = (360 + (f << 2)) | 0;
      c[(u + 28) >> 2] = f;
      c[(u + 20) >> 2] = 0;
      c[(u + 16) >> 2] = 0;
      b = c[15] | 0;
      e = 1 << f;
      a: do
        if (b & e) {
          d = c[d >> 2] | 0;
          b: do
            if (((c[(d + 4) >> 2] & -8) | 0) != (g | 0)) {
              f = g << ((f | 0) == 31 ? 0 : (25 - (f >>> 1)) | 0);
              while (1) {
                b = (d + 16 + ((f >>> 31) << 2)) | 0;
                e = c[b >> 2] | 0;
                if (!e) break;
                if (((c[(e + 4) >> 2] & -8) | 0) == (g | 0)) {
                  t = e;
                  break b;
                } else {
                  f = f << 1;
                  d = e;
                }
              }
              if (b >>> 0 < (c[18] | 0) >>> 0) fa();
              else {
                c[b >> 2] = u;
                c[(u + 24) >> 2] = d;
                c[(u + 12) >> 2] = u;
                c[(u + 8) >> 2] = u;
                break a;
              }
            } else t = d;
          while (0);
          b = (t + 8) | 0;
          d = c[b >> 2] | 0;
          l = c[18] | 0;
          if ((d >>> 0 >= l >>> 0) & (t >>> 0 >= l >>> 0)) {
            c[(d + 12) >> 2] = u;
            c[b >> 2] = u;
            c[(u + 8) >> 2] = d;
            c[(u + 12) >> 2] = t;
            c[(u + 24) >> 2] = 0;
            break;
          } else fa();
        } else {
          c[15] = b | e;
          c[d >> 2] = u;
          c[(u + 24) >> 2] = d;
          c[(u + 12) >> 2] = u;
          c[(u + 8) >> 2] = u;
        }
      while (0);
      l = ((c[22] | 0) + -1) | 0;
      c[22] = l;
      if (!l) b = 512;
      else return;
      while (1) {
        b = c[b >> 2] | 0;
        if (!b) break;
        else b = (b + 8) | 0;
      }
      c[22] = -1;
      return;
    }
    function Ba() {}
    function Ca(b, d, e) {
      b = b | 0;
      d = d | 0;
      e = e | 0;
      var f = 0,
        g = 0,
        h = 0,
        i = 0;
      f = (b + e) | 0;
      if ((e | 0) >= 20) {
        d = d & 255;
        h = b & 3;
        i = d | (d << 8) | (d << 16) | (d << 24);
        g = f & ~3;
        if (h) {
          h = (b + 4 - h) | 0;
          while ((b | 0) < (h | 0)) {
            a[b >> 0] = d;
            b = (b + 1) | 0;
          }
        }
        while ((b | 0) < (g | 0)) {
          c[b >> 2] = i;
          b = (b + 4) | 0;
        }
      }
      while ((b | 0) < (f | 0)) {
        a[b >> 0] = d;
        b = (b + 1) | 0;
      }
      return (b - e) | 0;
    }
    function Da(b, d, e) {
      b = b | 0;
      d = d | 0;
      e = e | 0;
      var f = 0;
      if ((e | 0) >= 4096) return ka(b | 0, d | 0, e | 0) | 0;
      f = b | 0;
      if ((b & 3) == (d & 3)) {
        while (b & 3) {
          if (!e) return f | 0;
          a[b >> 0] = a[d >> 0] | 0;
          b = (b + 1) | 0;
          d = (d + 1) | 0;
          e = (e - 1) | 0;
        }
        while ((e | 0) >= 4) {
          c[b >> 2] = c[d >> 2];
          b = (b + 4) | 0;
          d = (d + 4) | 0;
          e = (e - 4) | 0;
        }
      }
      while ((e | 0) > 0) {
        a[b >> 0] = a[d >> 0] | 0;
        b = (b + 1) | 0;
        d = (d + 1) | 0;
        e = (e - 1) | 0;
      }
      return f | 0;
    }

    // EMSCRIPTEN_END_FUNCS
    return {
      _malloc: za,
      _fftCross: xa,
      _memcpy: Da,
      _free: Aa,
      _memset: Ca,
      runPostSets: Ba,
      stackAlloc: oa,
      stackSave: pa,
      stackRestore: qa,
      establishStackSpace: ra,
      setThrew: sa,
      setTempRet0: va,
      getTempRet0: wa,
    };
  })(
    // EMSCRIPTEN_END_ASM
    Module.asmGlobalArg,
    Module.asmLibraryArg,
    buffer
  );
  var _fftCross = (Module["_fftCross"] = asm["_fftCross"]);
  var _free = (Module["_free"] = asm["_free"]);
  var runPostSets = (Module["runPostSets"] = asm["runPostSets"]);
  var _memset = (Module["_memset"] = asm["_memset"]);
  var _malloc = (Module["_malloc"] = asm["_malloc"]);
  var _memcpy = (Module["_memcpy"] = asm["_memcpy"]);
  Runtime.stackAlloc = asm["stackAlloc"];
  Runtime.stackSave = asm["stackSave"];
  Runtime.stackRestore = asm["stackRestore"];
  Runtime.establishStackSpace = asm["establishStackSpace"];
  Runtime.setTempRet0 = asm["setTempRet0"];
  Runtime.getTempRet0 = asm["getTempRet0"];
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
    assert(runDependencies == 0, "cannot call main when async dependencies remain! (listen on __ATMAIN__)");
    assert(__ATPRERUN__.length == 0, "cannot call main when preRun functions remain to be called");
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
        if (e && typeof e === "object" && e.stack) Module.printErr("exception thrown: " + [e, e.stack]);
        throw e;
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
      process["stdout"]["once"]("drain", function () {
        process["exit"](status);
      });
      console.log(" ");
      setTimeout(function () {
        process["exit"](status);
      }, 500);
    } else if (ENVIRONMENT_IS_SHELL && typeof quit === "function") {
      quit(status);
    }
    throw new ExitStatus(status);
  }
  Module["exit"] = Module.exit = exit;
  var abortDecorators = [];
  function abort(what) {
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

  return Module;
};

export default CrossModule;

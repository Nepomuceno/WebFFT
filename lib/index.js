import KissFftWrapperWasm from "./kissfft/webfftWrapper.js";
import IndutnyFftWrapperJavascript from "./indutny/webfftWrapper.js";
import DntjWebFftWrapperJavascript from "./dntj/webfftWrapper.js";
import CrossFftWrapperWasm from "./cross/webfftWrapper.js";
import NayukiFftWrapperJavascript from "./nayuki/webfftWrapper.js";
import NayukiWasmFftWrapperWasm from "./nayukic/webfftWrapper.js";
import NockertFftWrapperJavascript from "./nockert/webfftWrapper.js";

class webfft {
  constructor(size, subLibrary = "indutnyJavascript") {
    this.size = size;
    this.outputArr = new Float32Array(2 * size);
    this.subLibrary = subLibrary;
    this.fftLibrary = undefined;
    this.setSubLibrary(subLibrary);
  }

  setSubLibrary(subLibrary) {
    switch (subLibrary) {
      case "nayukiJavascript":
        this.fftLibrary = new NayukiFftWrapperJavascript(this.size);
        break;
      case "nayuki3Wasm":
        this.fftLibrary = new NayukiWasmFftWrapperWasm(this.size);
        break;
      case "kissWasm":
        this.fftLibrary = new KissFftWrapperWasm(this.size);
        break;
      case "crossWasm":
        this.fftLibrary = new CrossFftWrapperWasm(this.size);
        break;
      case "nockertJavascript":
        this.fftLibrary = new NockertFftWrapperJavascript(this.size);
        break;
      case "dntjJavascript":
        this.fftLibrary = new DntjWebFftWrapperJavascript(this.size);
        break;
      case "indutnyJavascript":
        this.fftLibrary = new IndutnyFftWrapperJavascript(this.size);
        break;
      default:
        this.fftLibrary = new IndutnyFftWrapperJavascript(this.size);
    }
  }

  fft(inputArr) {
    var { outputArr, fftLibrary } = this;
    if (inputArr.length !== 2 * this.size) {
      throw new Error("Input array length must be 2 * size");
    }
    outputArr = fftLibrary.fft(inputArr);
    return outputArr;
  }

  availableSubLibries() {
    return [
      "indutnyJavascript",
      "nockertJavascript",
      "nayukiJavascript",
      "nayuki3Wasm",
      "kissWasm",
      "crossWasm",
      "dntjJavascript"
    ];
  }

  profile(duration = 1) {
    const totalStart = performance.now();
    const subLibraries = this.availableSubLibries();
    let ffsPerSecond = [];
    const secondsPerRun = duration / subLibraries.length / 2; // split in half because of warmup
    for (let i = 0; i < subLibraries.length; i++) {
      //console.log("Starting", subLibraries[i]);
      this.setSubLibrary(subLibraries[i]);

      // Create input array
      const ci = new Float32Array(2 * this.size);
      for (let j = 0; j < this.size; j++) {
        ci[2 * j] = Math.random() - 0.5;
        ci[2 * j + 1] = Math.random() - 0.5;
      }

      // Warmup
      let start = performance.now();
      while ((performance.now() - start) / 1e3 < secondsPerRun) {
        const co = this.fft(ci);
      }

      // Benchmark
      start = performance.now();
      let numFfts = 0;
      while ((performance.now() - start) / 1e3 < secondsPerRun) {
        const co = this.fft(ci);
        numFfts++;
      }
      ffsPerSecond.push(numFfts / (performance.now() - start));
    }
    const totalElapsed = (performance.now() - totalStart) / 1e3;

    // Update current FFT method
    let argmax = ffsPerSecond.indexOf(Math.max(...ffsPerSecond));
    console.log("Setting sublibrary to", subLibraries[argmax]);
    this.setSubLibrary(subLibraries[argmax]);

    const profileObj = {
      ffsPerSecond: ffsPerSecond,
      subLibraries: subLibraries,
      totalElapsed: totalElapsed,
      fastestSubLibrary: subLibraries[argmax]
    };
    return profileObj;
  }
}

export default webfft;

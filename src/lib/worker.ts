import { env, pipeline } from '@huggingface/transformers';

// Skip local model check since we are running in the browser
env.allowLocalModels = false;

// We need a singleton pattern so we don't load the model multiple times
class PipelineSingleton {
  static task = 'automatic-speech-recognition';
  static model = 'Xenova/whisper-tiny.en'; // using tiny.en for faster browser load, distil-whisper is an option too
  static instance = null;

  static async getInstance(progress_callback = null) {
    if (this.instance === null) {
      this.instance = pipeline(this.task, this.model, { progress_callback });
    }
    return this.instance;
  }
}

export default PipelineSingleton;
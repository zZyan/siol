import { pipeline, env } from '@huggingface/transformers';

env.allowLocalModels = false;
env.backends.onnx.wasm.numThreads = 1;

class PipelineSingleton {
    static task: 'automatic-speech-recognition' = 'automatic-speech-recognition';
    static model = 'Xenova/whisper-tiny.en';
    static instance: any = null;

    static async getInstance(progress_callback: Function | null = null) {
        if (this.instance === null) {
            this.instance = pipeline(this.task, this.model, { progress_callback });
        }
        return this.instance;
    }
}

self.addEventListener('message', async (event) => {
    if (event.data.type === 'generate') {
        const audioData = event.data.audio;

        try {
            const transcriber = await PipelineSingleton.getInstance((x: any) => {
                if (x.status === "progress") {
                    self.postMessage({ status: 'progress', progress: x.progress });
                }
            });

            self.postMessage({ status: 'ready' });

            const result = await transcriber(audioData);
            self.postMessage({ status: 'complete', text: result.text });
        } catch (error: any) {
            self.postMessage({ status: 'error', error: error.message });
        }
    }
});
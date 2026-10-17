import { LiveConnectConfig, LiveServerMessage } from "@google/genai";
const config: LiveConnectConfig = {
  realtimeInputConfig: {
    automaticActivityDetection: {
      disabled: true
    }
  }
};
console.log(config);

// A soft, browser-synthesized music box. No audio files, downloads, or microphone access.
export class ChristmasMusic{
  constructor(){this.enabled=false;this.step=0;this.melody=[76,76,76,null,76,76,76,null,76,79,72,74,76,null,null,null,77,77,77,77,77,76,76,76,76,74,74,76,74,null,79,null];}
  async toggle(){
    if(this.enabled){this.stop();return false;}
    const AudioContext=window.AudioContext||window.webkitAudioContext;
    if(!AudioContext)throw new Error('这个浏览器暂时无法播放音乐');
    clearTimeout(this.suspendTimer);
    if(!this.context){
      this.context=new AudioContext();this.master=this.context.createGain();this.master.gain.value=.28;this.master.connect(this.context.destination);
      const reverb=this.context.createConvolver(),length=this.context.sampleRate*2,buffer=this.context.createBuffer(2,length,this.context.sampleRate);
      for(let c=0;c<2;c++){const d=buffer.getChannelData(c);for(let i=0;i<length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/length,3);}
      reverb.buffer=buffer;const wet=this.context.createGain();wet.gain.value=.17;reverb.connect(wet);wet.connect(this.master);this.reverb=reverb;
    }
    await this.context.resume();this.enabled=true;this.master.gain.cancelScheduledValues(this.context.currentTime);this.master.gain.setTargetAtTime(.28,this.context.currentTime,.08);this.nextTime=this.context.currentTime+.08;this.step=0;
    this.scheduler();this.interval=setInterval(()=>this.scheduler(),200);return true;
  }
  scheduler(){
    while(this.enabled&&this.nextTime<this.context.currentTime+.7){const note=this.melody[this.step%this.melody.length];if(note)this.bell(note,this.nextTime,.075);if(this.step%8===0)this.bell([48,53,55,48][Math.floor(this.step/8)%4],this.nextTime,.025,2);this.nextTime+=.43;this.step++;}
  }
  bell(midi,when,volume=.06,duration=1.6){
    const ctx=this.context,frequency=440*Math.pow(2,(midi-69)/12);
    for(const [ratio,amplitude] of [[1,1],[2,.22],[3,.08]]){const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sine';osc.frequency.value=frequency*ratio;gain.gain.setValueAtTime(0,when);gain.gain.linearRampToValueAtTime(volume*amplitude,when+.008);gain.gain.exponentialRampToValueAtTime(.0001,when+duration);osc.connect(gain);gain.connect(this.master);gain.connect(this.reverb);osc.start(when);osc.stop(when+duration+.05);}
  }
  sparkle(mode){if(!this.enabled)return;const notes=mode==='heart'?[76,79,83,88]:[79,83,86];notes.forEach((n,i)=>this.bell(n,this.context.currentTime+.04+i*.1,.04));}
  stop(){this.enabled=false;clearInterval(this.interval);if(this.context){this.master.gain.setTargetAtTime(0,this.context.currentTime,.1);this.suspendTimer=setTimeout(()=>{if(!this.enabled)this.context.suspend();},450);}}
}

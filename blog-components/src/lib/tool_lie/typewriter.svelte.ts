export class HeadlessTypewriter {
  text = $state("");

  private queue: Array<() => Promise<void>> = [];
  private isActive = false;

  typeString(str: string, speed: number = 50) {
    this.queue.push(async () => {
      for (let i = 0; i < str.length; i++) {
        if (!this.isActive) break;

        this.text += str[i];
        await this.sleep(speed);
      }
    });

    return this;
  }

  deleteChars(count: number, speed: number = 50) {
    this.queue.push(async () => {
      for (let i = 0; i < count; i++) {
        if (!this.isActive) break;

        this.text = this.text.slice(0, -1);
        await this.sleep(speed);
      }
    });

    return this;
  }

  deleteAll(speed: number = 50) {
    this.queue.push(async () => {
      while (this.text.length > 0) {
        if (!this.isActive) break;

        this.text = this.text.slice(0, -1);
        await this.sleep(speed);
      }
    });

    return this;
  }

  pauseFor(ms: number) {
    this.queue.push(async () => {
      if (this.isActive) await this.sleep(ms);
    });

    return this;
  }

  async start() {
    this.isActive = true;
    for (const action of this.queue) {
      if (!this.isActive) break;

      await action();
    }
  }

  stop() {
    this.isActive = false;
    this.queue = [];
  }

  reset() {
    this.text = "";
    this.stop();
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

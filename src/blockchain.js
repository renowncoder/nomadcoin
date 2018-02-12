class Block {
  constructor(index, hash, previousHash, timeStamp, data) {
    this.index = index;
    this.hash = hash;
    this.previousHash = previousHash;
    this.timeStamp = timeStamp;
    this.data = data;
  }
}

const toHexString = (byteArray): string => {
  return Array.from(byteArray, (byte: any) => {
    return ("0" + (byte & 0xff).toString(16)).slice(-2);
  }).join("");
};

module.exports = {
  toHexString
};

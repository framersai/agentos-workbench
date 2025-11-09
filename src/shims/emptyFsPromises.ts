const notSupported = (method: string) => {
  return () => {
    throw new Error(`[AgentOS Client] fs.promises.${method} is not available in this runtime.`);
  };
};

export const access = notSupported('access');
export const readFile = notSupported('readFile');
export const writeFile = notSupported('writeFile');
export const mkdir = notSupported('mkdir');
export const rm = notSupported('rm');
export const stat = notSupported('stat');
export const readdir = notSupported('readdir');

export default {
  access,
  readFile,
  writeFile,
  mkdir,
  rm,
  stat,
  readdir,
};

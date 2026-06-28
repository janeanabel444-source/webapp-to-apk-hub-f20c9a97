declare module "app-info-parser/src/apk" {
  export default class ApkParser {
    constructor(file: File | Blob | ArrayBuffer | string);
    parse(): Promise<Record<string, unknown>>;
  }
}
declare module "app-info-parser";

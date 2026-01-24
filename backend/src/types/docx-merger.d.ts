declare module "docx-merger" {
  export default class DocxMerger {
    constructor(options?: any, files?: any[]);
    initialize(options?: any, files?: any[]): Promise<void>;
    save(type: "nodebuffer" | "blob", cb: (data: Buffer) => void): void;
  }
}

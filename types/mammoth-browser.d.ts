declare module 'mammoth/mammoth.browser' {
  interface MammothBrowser {
    extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }>;
  }

  const mammoth: MammothBrowser;
  export default mammoth;
  export function extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }>;
}

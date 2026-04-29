import { describe, it, expect } from "vitest";
import { parseNfeXml } from "../../../src/services/fiscal.service.js";

const SAMPLE_NFE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc>
  <NFe>
    <infNFe Id="NFe35250400000000000000550010000000011234567891">
      <ide>
        <nNF>1</nNF>
        <serie>1</serie>
        <dhEmi>2025-04-01T10:00:00-03:00</dhEmi>
      </ide>
      <emit>
        <CNPJ>12345678000190</CNPJ>
        <xNome>Fornecedor Exemplo Ltda</xNome>
        <IE>123456789</IE>
      </emit>
      <dest>
        <CNPJ>98765432000100</CNPJ>
        <xNome>Tribus Antigravity</xNome>
      </dest>
      <det nItem="1">
        <prod>
          <xProd>Pulseira Gold</xProd>
          <NCM>71179000</NCM>
          <CFOP>5102</CFOP>
          <qCom>10.0000</qCom>
          <vUnCom>29.90</vUnCom>
          <vProd>299.00</vProd>
        </prod>
      </det>
      <det nItem="2">
        <prod>
          <xProd>Colar Prata</xProd>
          <NCM>71179000</NCM>
          <CFOP>5102</CFOP>
          <qCom>5.0000</qCom>
          <vUnCom>49.90</vUnCom>
          <vProd>249.50</vProd>
        </prod>
      </det>
      <total>
        <ICMSTot>
          <vNF>548.50</vNF>
        </ICMSTot>
      </total>
    </infNFe>
    <infNFeSupl>
      <chNFe>35250400000000000000550010000000011234567891</chNFe>
    </infNFeSupl>
  </NFe>
</nfeProc>`;

describe("parseNfeXml", () => {
  it("extracts access key", () => {
    const result = parseNfeXml(SAMPLE_NFE_XML);
    expect(result.accessKey).toBe("35250400000000000000550010000000011234567891");
  });

  it("extracts emitter info", () => {
    const result = parseNfeXml(SAMPLE_NFE_XML);
    expect(result.emitter.cnpj).toBe("12345678000190");
    expect(result.emitter.legalName).toBe("Fornecedor Exemplo Ltda");
  });

  it("extracts recipient info", () => {
    const result = parseNfeXml(SAMPLE_NFE_XML);
    expect(result.recipient.name).toBe("Tribus Antigravity");
  });

  it("extracts issue date correctly", () => {
    const result = parseNfeXml(SAMPLE_NFE_XML);
    expect(result.issueDate).toBe("2025-04-01");
  });

  it("extracts items", () => {
    const result = parseNfeXml(SAMPLE_NFE_XML);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]?.description).toBe("Pulseira Gold");
    expect(result.items[0]?.ncm).toBe("71179000");
    expect(result.items[0]?.quantity).toBe(10);
    expect(result.items[1]?.description).toBe("Colar Prata");
  });

  it("calculates total amount in cents", () => {
    const result = parseNfeXml(SAMPLE_NFE_XML);
    expect(result.totalAmountCents).toBe(54850);
  });

  it("extracts series and number", () => {
    const result = parseNfeXml(SAMPLE_NFE_XML);
    expect(result.number).toBe("1");
    expect(result.series).toBe("1");
  });
});

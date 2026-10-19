import { describe, expect, it } from 'vitest';
import { checkStatement, decodeStatement } from '../src/lib/backing';

// Made by the app's encodeStatement (src/lib/backing-link.ts): the two must stay compatible.
const DATA =
  'eyJ2IjoxLCJpZCI6ImtfYWJjMTIzIiwicGwiOiJSdWkgw5EiLCJiayI6IlPDo28gSm_Do28g8J-miCIsImN1ciI6IuKCrCIsImF0IjoxNzkyMjMzMzAwMDAwLCJiYWwiOjQ1MC41LCJtayI6MCwiaW52IjozNDUsInJlcyI6Nzk1LjUsInJvd3MiOlt7ImQiOjE3OTIyMTE3MDAwMDAsImUiOm51bGwsIm4iOiJNYWluIEV2ZW50IiwiayI6Im10dCIsInNoIjoyMCwibXUiOjEuMSwiYyI6NTUsIm8iOjAsInUiOjEsImwiOiJtMDhrTXQ3WEIxIn0seyJkIjoxNzkxMjExNzAwMDAwLCJlIjoxNzkxMjMzMzAwMDAwLCJuIjoiVG9ybmVpbyBkZSBTw6FiYWRvIiwiayI6Im10dCIsInNoIjo1MCwibXUiOjEsImMiOjEyNSwibyI6OTAwLCJwIjoiU8OpcmllIn1dfQ';
const JSON_TEXT =
  '{"v":1,"id":"k_abc123","pl":"Rui Ñ","bk":"São João 🦈","cur":"€","at":1792233300000,"bal":450.5,"mk":0,"inv":345,"res":795.5,"rows":[{"d":1792211700000,"e":null,"n":"Main Event","k":"mtt","sh":20,"mu":1.1,"c":55,"o":0,"u":1,"l":"m08kMt7XB1"},{"d":1791211700000,"e":1791233300000,"n":"Torneio de Sábado","k":"mtt","sh":50,"mu":1,"c":125,"o":900,"p":"Série"}]}';

describe('backer statement link', () => {
  it('decodes what the app encodes, accents and emoji included', () => {
    expect(Buffer.from(JSON_TEXT).toString('base64url')).toBe(DATA);
    expect(decodeStatement(`https://sweatbook.poker/b?r=ABC#${DATA}`)).toEqual(JSON.parse(JSON_TEXT));
    // What the page reads: location.hash.
    expect(decodeStatement('#' + DATA)).toEqual(JSON.parse(JSON_TEXT));
  });

  it('rejects junk and cleans bad fields', () => {
    expect(decodeStatement('https://sweatbook.poker/b#nope')).toBeNull();
    expect(checkStatement({ v: 1, id: 'bad id!', rows: [] })).toBeNull();
    const st = checkStatement({ v: 1, id: 'k_abc123', rows: [{ d: 1, l: 'javascript:alert(1)', sh: 500 }] })!;
    expect(st.rows[0].l).toBeUndefined();
    expect(st.rows[0].sh).toBe(0);
  });

  it('keeps the next event only with a venue clock', () => {
    expect(checkStatement({ v: 1, id: 'k_abc123', rows: [], nx: { n: '#3 Main Event', s: '2026-12-08T12:00' } })!.nx).toEqual({ n: '#3 Main Event', s: '2026-12-08T12:00' });
    expect(checkStatement({ v: 1, id: 'k_abc123', rows: [], nx: { n: 'x', s: '<script>' } })!.nx).toBeUndefined();
  });
});

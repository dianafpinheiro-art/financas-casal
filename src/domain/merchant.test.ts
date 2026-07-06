import { describe, it, expect } from 'vitest'
import { extrairMerchant } from './merchant'

describe('extrairMerchant', () => {
  it('exemplos do spec (A.1)', () => {
    expect(extrairMerchant('IFD CARREFOUR COMERCIO RECIFE')).toBe('carrefour')
    expect(extrairMerchant('CARREFOUR COMCAJAMARBRA')).toBe('carrefour')
    expect(extrairMerchant('KIWIFY *IACopy 10/12')).toBe('kiwify')
    expect(extrairMerchant('MERCADOLIVRE*13PRODUTOS')).toBe('mercadolivre')
  })

  it('gateway + merchant interno: o FINAL ganha do gateway', () => {
    expect(extrairMerchant('PAYPAL *RAPPIBRASIL')).toBe('rappi')
    expect(extrairMerchant('PAYPAL *GOOGLE BUDGET')).toBe('google')
    expect(extrairMerchant('MP *UBERSANDROO')).toBe('uber')
  })

  it('gateway sem merchant interno legível: cai no gateway', () => {
    expect(extrairMerchant('PAYPAL SUBSCRIPTION')).toBe('paypal')
    expect(extrairMerchant('MERCADOPAGO *M')).toBe('mercadopago')
    expect(extrairMerchant('KIWIFY *ALGO QUE NAO CONHECO')).toBe('kiwify')
  })

  it('merchants finais variados (variações de string viram o mesmo slug)', () => {
    expect(extrairMerchant('AMAZON BR SAO PAULO')).toBe('amazon')
    expect(extrairMerchant('AMAZONMKTPLC*1A2B3')).toBe('amazon')
    expect(extrairMerchant('CLAUDE.AI SUBSCRIPTION')).toBe('claude')
    expect(extrairMerchant('ANTHROPIC PBC')).toBe('claude')
    expect(extrairMerchant('LATAM AIR LINHAS AEREAS')).toBe('latam_air')
    expect(extrairMerchant('CLUBE LATAM PASS')).toBe('latam_pass')
    expect(extrairMerchant('SHEIN *ORDER123')).toBe('shein')
    expect(extrairMerchant('DROGASIL 456 RECIFE PE')).toBe('drogasil')
    expect(extrairMerchant('UBER *TRIP HELP.UBER.COM')).toBe('uber')
    expect(extrairMerchant('APPLECOMBILL CUPERTINO')).toBe('apple')
    expect(extrairMerchant('GOOGLE PLAY APP')).toBe('google')
    expect(extrairMerchant('SAMS RECIFE')).toBe('sams_club')
    expect(extrairMerchant('RED BALLOON RECIFE')).toBe('red_balloon')
    expect(extrairMerchant('TIKTOK')).toBe('tiktok')
    expect(extrairMerchant('O BOTICARIO 12')).toBe('boticario')
  })

  it('bancos / boletos específicos (ethos antes de bradesco)', () => {
    expect(extrairMerchant('BCO BRADESCO S.A')).toBe('ethos')
    expect(extrairMerchant('BCO BRADESCO')).toBe('bradesco')
    expect(extrairMerchant('BCO ITAU UNIBANCO')).toBe('itau')
    expect(extrairMerchant('BCO SANTANDER BRASIL')).toBe('santander')
  })

  it('gateways isolados', () => {
    expect(extrairMerchant('HUBLA *CURSO X')).toBe('hubla')
    expect(extrairMerchant('GREENN*PRODUTO')).toBe('greenn')
    expect(extrairMerchant('CAKTO *ALGO')).toBe('cakto')
    expect(extrairMerchant('PERFECTPAY*Y')).toBe('perfectpay')
  })

  it('fallback: tira prefixo/dígitos e pega a primeira palavra significativa', () => {
    expect(extrairMerchant('PADARIA DO ZE RECIFE')).toBe('padaria')
    expect(extrairMerchant('MP *PADARIABOA')).toBe('padariaboa')
    expect(extrairMerchant('POSTO SHELL 123')).toBe('posto')
    expect(extrairMerchant('13PRODUTOS LOJA')).toBe('produtos')
    expect(extrairMerchant('IFD RESTAURANTEXPTO')).toBe('ifood') // ifd\s+ casa o gateway ifood
  })

  it('entradas vazias/sujas não quebram', () => {
    expect(extrairMerchant('')).toBe('desconhecido')
    expect(extrairMerchant('   ')).toBe('desconhecido')
    expect(extrairMerchant('*** 123 ***')).toBe('desconhecido')
  })

  it('é determinístico (mesma entrada, mesmo slug)', () => {
    expect(extrairMerchant('IFD CARREFOUR X')).toBe(extrairMerchant('CARREFOUR Y'))
  })
})

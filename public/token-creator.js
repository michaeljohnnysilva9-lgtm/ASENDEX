(()=>{
  const RPC='https://testnet.asentum.com';
  const $=id=>document.getElementById(id);
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));

  function toUnits(value,decimals){
    const s=String(value).trim();
    if(!/^\d+(\.\d+)?$/.test(s)) throw Error('Supply inválido');
    const [whole,fraction='']=s.split('.');
    return (BigInt(whole)*10n**BigInt(decimals)+BigInt((fraction+'0'.repeat(decimals)).slice(0,decimals)||'0')).toString();
  }

  // Asentum VM evaluates the source and expects the LAST expression to return
  // the contract method object. This matches the canonical Asentum examples:
  // const PREFIX='...'; ({ init(args){...}, balanceOf(a){...}, ... });
  function contractSource(){
    return `
const BALANCE_PREFIX = 'balance:';
const ALLOWANCE_PREFIX = 'allowance:';

({
  init(args) {
    assert(!storage.get('initialized'), 'already initialized');
    assert(args && args.owner, 'owner required');
    const owner = String(args.owner).toLowerCase();
    const supply = String(args.totalSupply || '0');
    assert(BigInt(supply) > 0n, 'totalSupply must be positive');

    storage.set('initialized', '1');
    storage.set('name', String(args.name || 'ASENDEX'));
    storage.set('symbol', String(args.symbol || 'ASDX'));
    storage.set('decimals', String(args.decimals ?? '18'));
    storage.set('totalSupply', supply);
    storage.set(BALANCE_PREFIX + owner, supply);

    emit('Transfer', { from: null, to: owner, value: supply });
    return true;
  },

  name() {
    return storage.get('name') || '';
  },

  symbol() {
    return storage.get('symbol') || '';
  },

  decimals() {
    return storage.get('decimals') || '18';
  },

  totalSupply() {
    return storage.get('totalSupply') || '0';
  },

  balanceOf(address) {
    return storage.get(BALANCE_PREFIX + String(address).toLowerCase()) || '0';
  },

  allowance(owner, spender) {
    const key = ALLOWANCE_PREFIX + String(owner).toLowerCase() + ':' + String(spender).toLowerCase();
    return storage.get(key) || '0';
  },

  approve(spender, amount) {
    const owner = String(msg.sender).toLowerCase();
    const target = String(spender).toLowerCase();
    const value = BigInt(String(amount));
    assert(value >= 0n, 'invalid amount');
    storage.set(ALLOWANCE_PREFIX + owner + ':' + target, String(value));
    emit('Approval', { owner, spender: target, value: String(value) });
    return true;
  },

  transfer(to, amount) {
    const from = String(msg.sender).toLowerCase();
    const target = String(to).toLowerCase();
    const value = BigInt(String(amount));
    assert(value > 0n, 'amount must be positive');

    const fromKey = BALANCE_PREFIX + from;
    const toKey = BALANCE_PREFIX + target;
    const fromBalance = BigInt(storage.get(fromKey) || '0');
    assert(fromBalance >= value, 'insufficient balance');

    const toBalance = BigInt(storage.get(toKey) || '0');
    storage.set(fromKey, String(fromBalance - value));
    storage.set(toKey, String(toBalance + value));
    emit('Transfer', { from, to: target, value: String(value) });
    return true;
  },

  transferFrom(from, to, amount) {
    const owner = String(from).toLowerCase();
    const spender = String(msg.sender).toLowerCase();
    const target = String(to).toLowerCase();
    const value = BigInt(String(amount));
    assert(value > 0n, 'amount must be positive');

    const allowanceKey = ALLOWANCE_PREFIX + owner + ':' + spender;
    const approved = BigInt(storage.get(allowanceKey) || '0');
    assert(approved >= value, 'insufficient allowance');

    const fromKey = BALANCE_PREFIX + owner;
    const toKey = BALANCE_PREFIX + target;
    const fromBalance = BigInt(storage.get(fromKey) || '0');
    assert(fromBalance >= value, 'insufficient balance');
    const toBalance = BigInt(storage.get(toKey) || '0');

    storage.set(allowanceKey, String(approved - value));
    storage.set(fromKey, String(fromBalance - value));
    storage.set(toKey, String(toBalance + value));
    emit('Approval', { owner, spender, value: String(approved - value) });
    emit('Transfer', { from: owner, to: target, value: String(value) });
    return true;
  }
});
`;
  }

  function receiptFailed(j){
    const status=String(j?.status ?? '').toLowerCase();
    const success=j?.success;
    return success===false || String(success).toLowerCase()==='false' || status==='0x0' || status==='0' || status==='false' || !!j?.revertReason || !!j?.error;
  }

  async function waitReceipt(hash){
    for(let i=0;i<80;i++){
      try{
        const r=await fetch(RPC+'/receipts/'+hash,{cache:'no-store'});
        if(r.ok){
          const j=await r.json();
          if(j?.blockNumber){
            if(receiptFailed(j)) throw Error('TX revertida/falhou: '+(j.revertReason||j.error||hash));
            return j;
          }
        }
      }catch(e){
        if(String(e?.message||e).startsWith('TX revertida/falhou')) throw e;
      }
      await sleep(1500);
    }
    throw Error('Confirmação demorou demais. Confira a TX antes de tentar novamente.');
  }

  async function rpcView(address,method,args=[]){
    const r=await fetch(RPC+'/view',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({contract:address,method,args})
    });
    if(!r.ok) throw Error('RPC view '+method+' HTTP '+r.status);
    const j=await r.json();
    if(!j?.ok) throw Error(j?.reason||('view '+method+' failed'));
    return j.returnValue;
  }

  function collectAddresses(walletResult,receipt){
    const out=[];
    const add=v=>{
      if(typeof v!=='string') return;
      const a=v.trim();
      if(/^0x[0-9a-fA-F]{40}$/.test(a) && !out.some(x=>x.toLowerCase()===a.toLowerCase())) out.push(a);
    };
    const inspect=(obj,depth=0)=>{
      if(!obj||typeof obj!=='object'||depth>4) return;
      for(const [k,v] of Object.entries(obj)){
        if(/contractAddress|createdAddress|createdContract|contract/i.test(k)) add(v);
        if(v&&typeof v==='object') inspect(v,depth+1);
      }
    };
    add(receipt?.contractAddress);
    add(receipt?.createdAddress);
    add(receipt?.createdContract);
    add(receipt?.contract);
    add(walletResult?.contractAddress);
    add(walletResult?.address);
    inspect(receipt);
    inspect(walletResult);
    return out;
  }

  async function waitForContract(candidates,logEl){
    if(!candidates.length) throw Error('Deploy confirmado, mas wallet/receipt não retornaram endereço de contrato.');
    let last='';
    for(let attempt=1;attempt<=40;attempt++){
      for(const address of candidates){
        try{
          await rpcView(address,'name',[]);
          return address;
        }catch(e){
          last=e?.message||String(e);
        }
      }
      if(logEl) logEl.textContent='DEPLOY confirmado · aguardando contrato na RPC '+attempt+'/40…';
      await sleep(1500);
    }
    throw Error('Nenhum endereço do deploy foi reconhecido como contrato após 60s. Última resposta RPC: '+last);
  }

  async function validateArc20(address,wallet,symbolValue,decimalsValue,totalUnits){
    let last='';
    for(let attempt=1;attempt<=20;attempt++){
      try{
        const [sym,dec,total,balance,allow]=await Promise.all([
          rpcView(address,'symbol'),
          rpcView(address,'decimals'),
          rpcView(address,'totalSupply'),
          rpcView(address,'balanceOf',[String(wallet)]),
          rpcView(address,'allowance',[String(wallet),String(wallet)])
        ]);
        if(String(sym)!==symbolValue) throw Error('symbol retornou '+String(sym));
        if(String(dec)!==String(decimalsValue)) throw Error('decimals retornou '+String(dec));
        if(BigInt(String(total||'0'))!==BigInt(totalUnits)) throw Error('totalSupply incorreto');
        if(BigInt(String(balance||'0'))!==BigInt(totalUnits)) throw Error('balanceOf do deployer incorreto');
        BigInt(String(allow||'0'));
        return true;
      }catch(e){
        last=e?.message||String(e);
        await sleep(1500);
      }
    }
    throw Error(last||'falha desconhecida na validação ARC-20');
  }

  async function createToken(){
    const button=$('createTokenDirectBtn');
    const log=$('tokenCreatorLog');
    const result=$('tokenCreatorResult');
    button.disabled=true;
    result.style.display='none';
    let deployHash='';

    try{
      if(!window.asentum) await sleep(500);
      if(!window.asentum) throw Error('Asentum Wallet não detectada.');
      if(typeof window.asentum.deployContract!=='function') throw Error('Atualize a Asentum Wallet: deployContract não disponível.');

      const connection=await window.asentum.connect();
      const wallet=connection?.address || await window.asentum.getAddress?.();
      if(!wallet) throw Error('Wallet não conectada.');

      const tokenName=$('tcName').value.trim();
      const tokenSymbol=$('tcSymbol').value.trim().toUpperCase();
      const decimalsValue=Number($('tcDecimals').value);
      const humanSupply=$('tcSupply').value.trim();
      if(!tokenName || !/^[A-Z0-9]{2,10}$/.test(tokenSymbol) || !Number.isInteger(decimalsValue) || decimalsValue<0 || decimalsValue>30){
        throw Error('Revise nome, ticker e decimals.');
      }
      const totalUnits=toUnits(humanSupply,decimalsValue);

      log.textContent='1/2 · APROVE O DEPLOY NA WALLET';
      const deploy=await window.asentum.deployContract({source:contractSource()});
      deployHash=deploy?.txHash || deploy?.hash || '';
      if(!deployHash) throw Error('Wallet não retornou TX do deploy.');

      log.textContent='DEPLOY enviado · '+deployHash+' · aguardando receipt…';
      const deployReceipt=await waitReceipt(deployHash);
      const candidates=collectAddresses(deploy,deployReceipt);
      const address=await waitForContract(candidates,log);

      log.textContent='2/2 · CONTRATO EXISTE ON-CHAIN ✓ · APROVE O INIT';
      const initArgs={
        name:tokenName,
        symbol:tokenSymbol,
        decimals:String(decimalsValue),
        totalSupply:totalUnits,
        owner:String(wallet).toLowerCase()
      };
      const init=await window.asentum.callContract({
        to:address,
        method:'init',
        args:[initArgs],
        value:'0'
      });
      const initHash=init?.txHash || init?.hash || init;
      if(!initHash) throw Error('Wallet não retornou TX do init.');
      await waitReceipt(initHash);

      log.textContent='VALIDANDO ARC-20 NA RPC…';
      await validateArc20(address,wallet,tokenSymbol,decimalsValue,totalUnits);

      log.textContent='TOKEN CRIADO E VALIDADO ARC-20 ✓ · '+humanSupply+' '+tokenSymbol;
      result.style.display='block';
      result.innerHTML='<b class="good">'+tokenName+' ('+tokenSymbol+') CRIADO E VALIDADO ARC-20 ✓</b><br>'+ 
        'Contrato confirmado pela RPC ✓<br>symbol ✓ · decimals ✓ · totalSupply ✓ · balanceOf ✓ · allowance ✓<br>'+ 
        'Contrato: <span class="mono">'+address+'</span><br>'+ 
        'Deploy TX: <span class="mono">'+deployHash+'</span><br>'+ 
        'Init TX: <span class="mono">'+initHash+'</span><br>'+ 
        '<button class="ghost" id="copyNewToken">Copiar contrato</button> '+
        '<a class="btn" target="_blank" rel="noopener" href="https://www.auras.finance/pools">Criar pool '+tokenSymbol+'/ASE na Auras ↗</a>';
      $('copyNewToken').onclick=async()=>{
        await navigator.clipboard.writeText(address);
        $('copyNewToken').textContent='Copiado ✓';
      };
    }catch(e){
      const tx=deployHash?' · Deploy TX: '+deployHash:'';
      log.textContent='Criação interrompida: '+(e?.message||String(e))+tx+' · NÃO USE NA AURAS.';
    }finally{
      button.disabled=false;
    }
  }

  document.addEventListener('DOMContentLoaded',()=>$('createTokenDirectBtn')?.addEventListener('click',createToken));
})();
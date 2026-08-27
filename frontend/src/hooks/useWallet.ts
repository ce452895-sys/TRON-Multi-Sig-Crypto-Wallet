import { useState } from "react";

export function useWallet() {
  const [address, setAddress] = useState("");
  const [balance, setBalance] = useState(0);

  async function connectWallet() {
    const tronLink = (window as any).tronLink;
    const tronWeb = (window as any).tronWeb;

    if (!tronLink || !tronWeb) {
      alert("Please install TronLink");
      return;
    }

    await tronLink.request({
      method: "tron_requestAccounts",
    });

    const addr = tronWeb.defaultAddress.base58;
    setAddress(addr);

    try {
      const sun = await tronWeb.trx.getBalance(addr);
      console.log("Balance in SUN:", sun);

      const trx = tronWeb.fromSun(sun);
      console.log("Balance in TRX:", trx);

      setBalance(Number(trx));
    } catch (err) {
      console.error(err);
    }
  }

  return {
    address,
    balance,
    connectWallet,
  };
}
    

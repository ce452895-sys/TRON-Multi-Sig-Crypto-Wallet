import { useState } from "react";

export function useWallet() {
  const [address, setAddress] = useState("");

  async function connectWallet() {
    const tronLink = (window as any).tronLink;
    const tronWeb = (window as any).tronWeb;

    if (!tronLink || !tronWeb) {
      alert("Please install and unlock TronLink.");
      return;
    }

    await tronLink.request({
      method: "tron_requestAccounts",
    });

    setAddress(tronWeb.defaultAddress.base58);
  }

  return {
    address,
    connectWallet,
  };
}

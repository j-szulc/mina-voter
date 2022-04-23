import { Field, isReady, shutdown, Mina, Party, UInt64, PrivateKey, compile, Bool, PublicKey } from 'snarkyjs';
import { Voting } from './index'


/**
 * Wraps zkapp contract running on a local simulator.
 */
class VotingSimulator {
  private _deployer: PrivateKey;
  private _voter: PrivateKey;
  private _snappAddress: PublicKey;
  private _snappPrivateKey: PrivateKey

  constructor() {
    const Local = Mina.LocalBlockchain();
    Mina.setActiveInstance(Local);
    this._deployer = Local.testAccounts[0].privateKey;
    this._voter = Local.testAccounts[1].privateKey;
    
    this._snappPrivateKey = PrivateKey.random();
    this._snappAddress = this._snappPrivateKey.toPublicKey();
  }

  async deploy() {
    let tx = Mina.transaction(this._deployer, () => {
      const initialBalance = UInt64.fromNumber(1000000);
      const p = Party.createSigned(this._voter);
      p.balance.subInPlace(initialBalance);
      const snapp = new Voting(this._snappAddress);
      snapp.deploy({ zkappKey: this._snappPrivateKey });
      snapp.balance.addInPlace(initialBalance);
    });
    await tx.send().wait();
  }

  async vote(vote: boolean) {
    const { forCounter, againstCounter } = await this.getFieldState();
    let tx = Mina.transaction(this._voter, () => {
      const snapp = new Voting(this._snappAddress);
      snapp.vote(forCounter, againstCounter, new Bool(vote));
      snapp.self.sign(this._snappPrivateKey);
      snapp.self.body.incrementNonce = new Bool(true);
    });
    await tx.send().wait();
  }

  async getFieldState() {
    let snappState = (await Mina.getAccount(this._snappAddress)).zkapp.appState;
    return {
      forCounter: snappState[0],
      againstCounter: snappState[1]
    };
  }

  async getState() {
    const { forCounter, againstCounter } = await this.getFieldState();
    return {
      forCounter: parseInt(forCounter.toString()),
      againstCounter: parseInt(againstCounter.toString())
    };
  }
}


(async () => {
  await isReady;
  
  const snapp = new VotingSimulator();
  await snapp.deploy();
  console.log(await snapp.getState())
  await snapp.vote(true);
  console.log(await snapp.getState())

  await shutdown();
})()

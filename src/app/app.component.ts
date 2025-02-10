import { AfterViewInit, Component, effect, OnDestroy, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import DiceBox from '@3d-dice/dice-box';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { AuraIconComponent } from "./components/aura-icon/aura-icon.component";

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ReactiveFormsModule, CommonModule, AuraIconComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements AfterViewInit, OnInit, OnDestroy {
  diceBox: any;
  diceBoxInitPromise: Promise<void> | undefined;
  rollHistory = signal([] as RollResult[]);
  theme = signal('');

  characteristicsForm = new FormGroup({
    might: new FormControl<number>(0, { nonNullable: true }),
    agility: new FormControl<number>(0, { nonNullable: true }),
    reason: new FormControl<number>(0, { nonNullable: true }),
    intuition: new FormControl<number>(0, { nonNullable: true }),
    presence: new FormControl<number>(0, { nonNullable: true }),
  });

  rollOptionsForm = new FormGroup({
    characteristic: new FormControl<string | null>(null),
    numEdges: new FormControl<number>(0, { nonNullable: true }),
    numBanes: new FormControl<number>(0, { nonNullable: true }),
  });

  subscriptions: Subscription[] = [];

  constructor() {
    this.subscriptions.push(
      this.characteristicsForm.valueChanges.subscribe((value) => {
        if (this.characteristicsForm.valid) {
          sessionStorage.setItem('characteristics', JSON.stringify(value));
        }
      })
    );

    const html = document.querySelector('html')!;
    this.theme.set(sessionStorage.getItem('theme') || html.dataset['theme'] || 'light');

    effect(() => {
      html.dataset['theme'] = this.theme();
      sessionStorage.setItem('theme', this.theme());  
    });

    this.rollHistory.set(JSON.parse(sessionStorage.getItem('history') || '[]'));

    effect(() => {
      sessionStorage.setItem('history', JSON.stringify(this.rollHistory()));
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  ngOnInit(): void {

    let characteristics = sessionStorage.getItem('characteristics');
    if (characteristics) {
      this.characteristicsForm.setValue(JSON.parse(characteristics));
    }
  }

  ngAfterViewInit(): void {
    new DiceBox({
      assetPath: '/assets/', // include the trailing backslash
      container: '.dice-box',
      scale: 9,
      gravity: 2,
      friction: 1,  
    })
      .init()
      .then((diceBox: any) => (this.diceBox = diceBox));
  }

  toggleTheme(): void {
    const html = document.querySelector('html')!;

    this.theme.update(t => t === 'dark' ? 'light' : 'dark');
    html.dataset['theme'] = this.theme();
    sessionStorage.setItem('theme', this.theme());
  }

  toggleEdge(count: number): void {
    if (this.rollOptionsForm.value.numEdges === count) {
      this.rollOptionsForm.patchValue({ numEdges: 0 });
    } else {
      this.rollOptionsForm.patchValue({ numEdges: count });
    }
  }

  toggleBane(count: number): void {
    if (this.rollOptionsForm.value.numBanes === count) {
      this.rollOptionsForm.patchValue({ numBanes: 0 });
    } else {
      this.rollOptionsForm.patchValue({ numBanes: count });
    }
  }

  async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.diceBox) {
      return;
    }
    
    let modifier = 0;
    let tierModifier = 0;
    let characteristicModifier = 0;
    let { characteristic, numEdges, numBanes } = this.rollOptionsForm.getRawValue();

    if (characteristic) {
      let key = characteristic as keyof typeof this.characteristicsForm.value;
      characteristicModifier = this.characteristicsForm.getRawValue()[key];
    }

    if (numEdges === 1) {
      modifier += 2;
    }

    if (numEdges === 2) {
      if (numBanes === 1) {
        modifier += 4;
      } else {
        tierModifier += 1;
      }
    }

    if (numBanes === 1) {
      modifier -= 2;
    }

    if (numBanes === 2) {
      if (numEdges === 1) {
        modifier -= 4;
      } else {
        tierModifier -= 1;
      }
    }

    const result = (await this.diceBox.roll(`2d10`)) as any[];
    const naturalResult = result.reduce((s, r) => (s += r.value), 0);
    const sum = naturalResult + modifier + characteristicModifier;

    const naturalCrit = naturalResult >= 19;
    let tier = naturalCrit ? 3 : (sum <= 11 ? 1 : sum <= 16 ? 2 : 3) + tierModifier;
    tier = tier < 1 ? 1 : tier > 3 ? 3 : tier; // make sure tier didn't get out of bounds

    this.rollHistory.update(history => [{
      characteristic: characteristic,
      characteristicModifier,
      numBanes,
      numEdges,
      roll1: result[0].value,
      roll2: result[1].value,
      rollSum: naturalResult,
      sum,
      tier
    }, ...history]);

    // reset form, leave characteristic set
    this.rollOptionsForm.patchValue({
      numBanes: 0,
      numEdges: 0
    });
  }
}

interface RollResult {
  characteristic: string | null;
  characteristicModifier: number;
  numEdges: number;
  numBanes: number;
  roll1: number;
  roll2: number;
  rollSum: number;
  sum: number;
  tier: number;
}
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Actions, Effect, ofType, createEffect } from '@ngrx/effects';
import { map, switchMap } from 'rxjs/operators';
import * as IntersectionActions from './intersection.actions';
import { of } from 'rxjs';
import { IntersectionLane } from '../models/intersection-lane.model';
import * as fromSignals from '../../signals/store/signal.actions';
import { IntersectionTrafficLight } from '../models/intersection-traffic-light.model';
import { IntersectionService } from './intersection.service';
import { WsEvent } from '../../../core/socket/ws-event';
import { Intersection } from '../models/intersection.model';
import { IntersectionSwitching } from '../models/intersection-switching.model';
import { LuaSettings } from '../../../shared/model/lua-settings';
import { LuaSetting } from '../../../shared/model/lua-setting';

@Injectable()
export class IntersectionEffects {
  @Effect()
  fetchIntersectionTrafficLights$ = this.intersectionService.getTrafficLightActions().pipe(
    switchMap((wsEvent: WsEvent) => {
      const list: IntersectionTrafficLight[] = JSON.parse(wsEvent.payload);
      const signalModels = new Map<number, string>();
      for (const element of list) {
        if (!element.lightStructures) {
          element.lightStructures = {};
        }
        if (!element.axisStructures) {
          element.axisStructures = [];
        }
        if (element.modelId) {
          signalModels.set(element.signalId, element.modelId);
        }
      }
      return of(
        IntersectionActions.setTrafficLights({ trafficLights: list }),
        new fromSignals.SetSignalTypes(signalModels)
      );
    })
  );

  @Effect()
  fetchIntersections$ = this.intersectionService.getIntersectionActions().pipe(
    switchMap((wsEvent: WsEvent) => {
      const list: Intersection[] = JSON.parse(wsEvent.payload);

      return of(IntersectionActions.setIntersections({ intersections: list }));
    })
  );

  @Effect()
  fetchIntersectionSwitchings$ = this.intersectionService.getSwitchingActions().pipe(
    switchMap((wsEvent: WsEvent) => {
      const list: IntersectionSwitching[] = JSON.parse(wsEvent.payload);

      return of(IntersectionActions.setSwitchings({ switchings: list }));
    })
  );

  @Effect()
  intersectionLanesActions$ = this.intersectionService.getLaneActions().pipe(
    switchMap((wsEvent: WsEvent) => {
      const list: IntersectionLane[] = JSON.parse(wsEvent.payload);

      return of(IntersectionActions.setLanes({ lanes: list }));
    })
  );

  @Effect()
  luaModuleSettingsReceivedAction$ = this.intersectionService.getLuaSettingsReceivedActions().pipe(
    switchMap((wsEvent: WsEvent) => {
      const list: LuaSetting<any>[] = JSON.parse(wsEvent.payload);
      const settings = new LuaSettings('Kreuzungen', list);

      return of(IntersectionActions.setModuleSettings({ settings: settings }));
    })
  );

  @Effect({ dispatch: false }) // effect will not dispatch any actions
  changeSettingCommand$ = this.actions$.pipe(
    ofType(IntersectionActions.changeModuleSettings),
    map((action) => {
      const command = action.setting.eepFunction + '|' + action.value;
      this.intersectionService.emit(new WsEvent('[EEPCommand]', 'Send', command));
    })
  );

  @Effect({ dispatch: false }) // effect will not dispatch any actions
  switchManuallyCommand$ = this.actions$.pipe(
    ofType(IntersectionActions.switchManually),
    map((action) => {
      const command = 'AkKreuzungSchalteManuell|' + action.intersection.name + '|' + action.switching.name;
      this.intersectionService.emit(new WsEvent('[EEPCommand]', 'Send', command));
    })
  );

  @Effect({ dispatch: false }) // effect will not dispatch any actions
  switchAutomaticallyCommand$ = this.actions$.pipe(
    ofType(IntersectionActions.switchAutomatically),
    map((action) => {
      const command = 'AkKreuzungSchalteAutomatisch|' + action.intersection.name;
      this.intersectionService.emit(new WsEvent('[EEPCommand]', 'Send', command));
    })
  );

  @Effect({ dispatch: false }) // effect will not dispatch any actions
  switchToCamCommand$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(IntersectionActions.switchToCam),
        map((action) => {
          const command = 'EEPSetCamera|0|' + action.staticCam;
          this.intersectionService.emit(new WsEvent('[EEPCommand]', 'Send', command));
        })
      ),
    { dispatch: false }
  );

  constructor(
    private actions$: Actions,
    private httpClient: HttpClient,
    private router: Router,
    private intersectionService: IntersectionService
  ) {}
}

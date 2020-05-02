import { Injectable } from '@angular/core';
import { Effect } from '@ngrx/effects';
import { of } from 'rxjs';
import { catchError, filter, switchMap } from 'rxjs/operators';

import { SocketEvent } from '../../socket/socket-event';
import { Versions } from '../../model/versions.model';
import { VersionInfo } from '../../model/version-info.model';
import * as fromCore from '../../store/core.actions';
import { SocketService } from '../../socket/socket-service';
import { WsEventUtil } from '../../socket/ws-event-util';
import * as fromDataTypes from './data-types.actions';
import { DataTypesService } from './data-types.service';

@Injectable()
export class DataTypesEffects {

  @Effect()
  init$ = this.wsService
    .listen('[Data-eep-version]')
    .pipe(
      filter(wsEvent => wsEvent.action === 'Set'),
      switchMap((wsEvent: SocketEvent) => {
        const versions: Versions = JSON.parse(wsEvent.payload);
        const versionInfo: VersionInfo = versions.versionInfo;

        return of(
          fromCore.setEepVersion({ version: versionInfo.eepVersion }),
          fromCore.setEepLuaVersion({ version: versionInfo.luaVersion }));
      }
      )
    );

  @Effect()
  dataTypes = this.dataTypesService.getActions().pipe(
    filter(wsEvent => WsEventUtil.storeAction(wsEvent) === fromDataTypes.setDataTypes.type),
    switchMap(
      (wsEvent: SocketEvent) => {
        return of(
          fromDataTypes.setDataTypes({ types: JSON.parse(wsEvent.payload) }),
          fromCore.setConnectionStatusSuccess());
      }
    ),
    catchError(error => {
      console.log(error);
      return of(fromCore.setConnectionStatusError());
    })
  );

  constructor(private wsService: SocketService,
    private dataTypesService: DataTypesService) {
  }
}

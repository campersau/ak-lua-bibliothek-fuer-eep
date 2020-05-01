import electron = require('electron');
import fs from 'fs';
import path from 'path';
import { Server, Socket } from 'socket.io';

import { Room, SocketEvent } from 'web-shared';
import SocketService from '../clientio/socket-manager';
import CommandEffects from '../command/command-effects';
import EepService from '../eep/eep-service';
import JsonDataEffects from '../json/json-data-effects';
import LogEffects from '../log/log-effects';
import AppConfig from './app-config';
import AppReducer from './app-reducer';

export default class AppEffects {
  private serverConfigPath = path.resolve(electron.app.getPath('appData'), 'eep-web-server');
  private serverConfigFile = path.resolve(this.serverConfigPath, 'settings.json');
  private jsonDataEffects: JsonDataEffects;
  private logEffects: LogEffects;
  private commandEffects: CommandEffects;
  private store = new AppReducer(this);

  constructor(private app: any, private io: Server, private socketService: SocketService) {
    this.loadConfig();
    this.socketService.addOnRoomsJoinedCallback((socket: Socket, joinedRooms: string[]) =>
      this.onRoomsJoined(socket, joinedRooms)
    );
  }

  private onRoomsJoined(socket: Socket, joinedRooms: string[]) {
    if (joinedRooms.indexOf(Room.ServerSettings) > -1) {
      const event = this.store.getEepDirOk() ? SocketEvent.DirOk : SocketEvent.DirError;
      console.log('EMIT ' + event + ' to ' + socket.id);
      socket.emit(event, this.getEepDirectory());
    }

    socket.on(SocketEvent.ChangeDir, (dir: string) => {
      console.log(SocketEvent.ChangeDir + '"' + dir + '"');
      this.changeEepDirectory(dir);
    });
  }

  private loadConfig(): void {
    let appConfig = new AppConfig();
    try {
      if (fs.statSync(this.serverConfigFile).isFile()) {
        const data = fs.readFileSync(this.serverConfigFile, { encoding: 'utf8' });
        const config = JSON.parse(data);
        appConfig = config;
      }
    } catch (error) {
      // IGNORE console.log(error);
    }
    this.store.setAppConfig(appConfig);
    this.io.to(Room.ServerSettings).emit(SocketEvent.DirError, this.store.getEepDir());
  }

  private saveConfig(config: { eepDir: string }): void {
    try {
      fs.mkdirSync(this.serverConfigPath);
    } catch (error) {
      // IGNORE console.log(error);
    }
    try {
      fs.writeFileSync(this.serverConfigFile, JSON.stringify(config));
    } catch (error) {
      console.log(error);
    }
  }

  public getEepDirectory(): string {
    return this.store.getEepDir();
  }

  public saveEepDirectory(dir: string): void {
    this.store.setEepDir(dir);
    this.saveConfig(this.store.getAppConfig());
  }

  public changeEepDirectory(eepDir: string) {
    // Append the exchange directory to the path
    const completeDir = path.resolve(eepDir, 'LUA/ak/io/exchange/');

    // Check the directory and register handlers on success
    const fileOperations = new EepService();
    fileOperations.reInit(completeDir, (err: string, dir: string) => {
      if (err) {
        console.error(err);
        this.store.setEepDirOk(false);
        this.io.to(Room.ServerSettings).emit(SocketEvent.DirError, eepDir);
      } else if (dir) {
        console.log('Directory set to : ' + dir);
        this.registerHandlers(fileOperations);
        this.store.setEepDirOk(true);
        this.saveEepDirectory(eepDir);
        this.io.to(Room.ServerSettings).emit(SocketEvent.DirOk, eepDir);
      } else {
        this.store.setEepDirOk(false);
        this.io.to(Room.ServerSettings).emit(SocketEvent.DirError, eepDir);
      }
    });
  }

  private registerHandlers(eepService: EepService) {
    // Init JsonHandler
    this.jsonDataEffects = new JsonDataEffects(this.app, this.io, this.socketService);
    eepService.setOnJsonContentChanged((jsonString: string) => this.jsonDataEffects.jsonDataUpdated(jsonString));

    // Init LogHandler
    this.logEffects = new LogEffects(this.app, this.io, this.socketService, eepService.getCurrentLogLines);
    eepService.setOnNewLogLine((logLines: string) => this.logEffects.onNewLogLine(logLines));

    // Init LogHandler
    this.commandEffects = new CommandEffects(this.app, this.io, this.socketService, eepService.queueCommand);
  }
}

import { AfterViewInit, Component } from '@angular/core';
import { Dialog } from '@capacitor/dialog';
import { STORAGE_KEYS } from '@constants';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { tileLayerOffline, savetiles, TileLayerOffline } from 'leaflet.offline';
// import { Geolocation } from '@capacitor/geolocation';
import {
  FitBoundsOptions,
  geoJSON,
  LatLngBounds,
  Map,
  MapOptions,
  MarkerClusterGroup,
  MarkerClusterGroupOptions,
  tileLayer,
} from 'leaflet';
import { mapHelper } from '@helpers';
import { GeoJsonPostsResponse, PostsService } from '@mzima-client/sdk';
import { DatabaseService, SessionService } from '@services';
import { MapConfigInterface } from '@models';
import { Subject } from 'rxjs';
import { Router } from '@angular/router';

@UntilDestroy()
@Component({
  selector: 'app-map-view',
  templateUrl: './map-view.component.html',
  styleUrls: ['./map-view.component.scss'],
})
export class MapViewComponent implements AfterViewInit {
  public map: Map;
  public isMapReady = false;
  public leafletOptions: MapOptions;
  public mapLayers: any[] = [];
  public mapFitToBounds: LatLngBounds;
  public fitBoundsOptions: FitBoundsOptions = {
    animate: true,
  };
  private mapConfig: MapConfigInterface;
  public markerClusterData = new MarkerClusterGroup();
  public markerClusterOptions: MarkerClusterGroupOptions = { animate: true, maxClusterRadius: 50 };
  public $destroy = new Subject();
  private isDarkMode = false;
  private baseLayer: 'streets' | 'satellite' | 'hOSM' | 'MapQuestAerial' | 'MapQuest' | 'dark';
  public isConnection = true;
  offlineLayer: TileLayerOffline;

  constructor(
    private postsService: PostsService,
    private sessionService: SessionService,
    private router: Router,
    private databaseService: DatabaseService,
  ) {
    const mediaDarkMode = window.matchMedia('(prefers-color-scheme: dark)');
    mediaDarkMode.addEventListener('change', (ev) => this.switchMode(ev));
    this.isDarkMode = mediaDarkMode.matches;
    this.initMapConfigListener();
  }

  private initMapConfigListener() {
    this.sessionService.mapConfig$.subscribe({
      next: (mapConfig) => {
        if (mapConfig) {
          this.mapConfig = mapConfig;

          this.baseLayer = this.mapConfig.default_view!.baselayer;
          const currentLayer = mapHelper.getMapLayer(this.baseLayer, this.isDarkMode);
          this.offlineLayer = tileLayerOffline(currentLayer.url, currentLayer.layerOptions);
          this.leafletOptions = {
            minZoom: 3,
            maxZoom: 17,
            scrollWheelZoom: true,
            zoomControl: false,
            layers: [this.offlineLayer],
            center: [this.mapConfig.default_view!.lat, this.mapConfig.default_view!.lon],
            zoom: this.mapConfig.default_view!.zoom,
          };
          this.markerClusterOptions.maxClusterRadius = this.mapConfig.cluster_radius;
        }
      },
    });
  }

  private switchMode(systemInitiatedDark: any) {
    this.isDarkMode = systemInitiatedDark.matches;

    const currentLayer = mapHelper.getMapLayer(this.baseLayer, this.isDarkMode);

    this.leafletOptions.layers = [tileLayer(currentLayer.url, currentLayer.layerOptions)];

    this.isMapReady = false;
    setTimeout(() => {
      this.isMapReady = true;
    }, 50);
  }

  public reInitParams() {
    this.mapLayers.map((layer) => {
      this.map.removeLayer(layer);
      this.markerClusterData.removeLayer(layer);
    });
    this.mapLayers = [];
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.isMapReady = true;
    }, 200);
  }

  // public async getCurrentLocation() {
  //   try {
  //     const status = await Geolocation.requestPermissions();
  //     // if (status?.location === 'granted') {
  //     //   const location = await Geolocation.getCurrentPosition();
  //     //   const {
  //     //     coords: { latitude, longitude },
  //     //   } = location;
  //       // this.location.lat = latitude;
  //       // this.location.lng = longitude;
  //       // this.addMarker();
  //       // this.map.setView([latitude, longitude], 12);
  //     }
  //   } catch (e) {
  //     console.log(e);
  //   }
  // }

  public onMapReady(map: Map) {
    this.map = map;
    const currentZoom = map.getZoom();

    console.log('currentZoom', currentZoom);
    const saveControl = savetiles(this.offlineLayer, {
      position: 'bottomleft',
      saveWhatYouSee: true,
      zoomlevels: [currentZoom],
      alwaysDownload: false,
      confirm: async (layer: any, successCallback: any) => {
        const { value } = await Dialog.confirm({
          title: 'Offline',
          message: `Save ${layer._tilesforSave.length} current tiles for offline use?`,
        });

        if (value) {
          successCallback();
        }
      },
      confirmRemoval: async (layer: any, successCallback: any) => {
        console.log('layerlayer', layer);
        const { value } = await Dialog.confirm({
          title: 'Offline',
          message: `Remove all the tiles?`,
        });

        if (value) {
          successCallback();
        }
      },
      saveText: 'S',
      rmText: 'D',
    });
    saveControl.addTo(this.map);
  }

  public getPostsGeoJson() {
    this.postsService
      .getGeojson({ limit: 100000, offset: 0, page: 1 })
      .pipe(untilDestroyed(this))
      .subscribe({
        next: async (postsResponse) => {
          await this.databaseService.set(STORAGE_KEYS.GEOJSONPOSTS, postsResponse);
          this.geoJsonDataProcessor(postsResponse);
        },
        error: async (err) => {
          if (err.message.match(/Http failure response for/)) {
            const posts = await this.databaseService.get(STORAGE_KEYS.GEOJSONPOSTS);
            if (posts) {
              this.geoJsonDataProcessor(posts);
            }
          }
        },
      });
  }

  private geoJsonDataProcessor(posts: GeoJsonPostsResponse) {
    const oldGeoJson: any = posts.results.map((r) => {
      return {
        type: r.geojson.type,
        features: r.geojson.features.map((f) => {
          f.properties = {
            id: r.id,
            type: r.source,
          };
          return f;
        }),
      };
    });
    const geoPosts = geoJSON(oldGeoJson, {
      pointToLayer: mapHelper.pointToLayer,
      onEachFeature: (feature, layer) => {
        layer.on('mouseout', () => {
          layer.unbindPopup();
        });
        layer.on('click', () => {
          this.router.navigate([feature.properties.id]);
        });
      },
    });

    if (this.mapConfig.clustering) {
      this.markerClusterData.addLayer(geoPosts);
      this.mapLayers.push(this.markerClusterData);
    } else {
      this.mapLayers.push(geoPosts);
    }

    if (posts.results.length) {
      this.mapFitToBounds = geoPosts.getBounds();
    }
  }

  public destroy(): void {
    this.$destroy.next(null);
    this.$destroy.complete();
  }
}

import React from 'react';
import simpleheat from 'simpleheat';
import L, { Map, LatLng, Point, Layer, ZoomAnimEvent } from 'leaflet';
import { MapLayer, MapLayerProps, withLeaflet } from 'react-leaflet';

const isInvalid = (num: number): boolean => {
  return !Number(num) && !num;
}

const isValidLatLngArray = (arr: number[]): boolean => {
  return arr.filter(isInvalid).length === arr.length;
}

const isInvalidLatLngArray = (arr: number[]): boolean => {
  return !isValidLatLngArray(arr);
}

// TODO: fix any
const safeRemoveLayer = (leafletMap: Map, el: HTMLElement): void => {
  const { overlayPane } = leafletMap.getPanes();
  if (overlayPane && overlayPane.contains(el)) {
    overlayPane.removeChild(el);
  }
}

const shouldIgnoreLocation = (loc: LatLng): boolean => {
  return isInvalid(loc.lat) || isInvalid(loc.lng);
}

interface HeatmapLayerProps extends MapLayerProps {
  points?: Point[],
  fitBoundsOnLoad?: boolean,
  fitBoundsOnUpdate?: boolean,
  onStatsUpdate?: () => void,
  /* props controlling heatmap generation */
  max?: number;
  radius?: number,
  maxZoom?: number,
  minOpacity?: number,
  blur?: number,
  gradient?: Object,
  latitudeExtractor: (p: Point) => number,
  longitudeExtractor: (p: Point) => number,
  intensityExtractor: (p: Point) => number,
};

class HeatmapLayer extends MapLayer<HeatmapLayerProps> implements HeatmapLayerProps {
  points?: Point[];
  max?: number;
  radius?: number;
  maxZoom?: number;
  minOpacity?: number;
  blur?: number;
  gradient?: Object;
  fitBoundsOnLoad?: boolean;
  fitBoundsOnUpdate?: boolean;

  latitudeExtractor: (p: Point) => number;
  longitudeExtractor: (p: Point) => number;
  intensityExtractor: (p: Point) => number;
  onStatsUpdate?: () => void;

  private _el!: HTMLCanvasElement;

  constructor(props: HeatmapLayerProps) {
    super(props);
    this.points = props.points || [];
    this.max = props.max || 3;
    this.radius = props.radius || 30;
    this.maxZoom = props.maxZoom || 18;
    this.minOpacity = props.minOpacity || 0.01;
    this.blur = props.blur || 15;
    this.gradient = props.gradient || {};
    this.fitBoundsOnLoad = props.fitBoundsOnLoad || false;
    this.fitBoundsOnUpdate = props.fitBoundsOnUpdate || false;
    this.latitudeExtractor = props.latitudeExtractor;
    this.longitudeExtractor = props.longitudeExtractor;
    this.intensityExtractor = props.intensityExtractor;
    this.onStatsUpdate = props.onStatsUpdate || undefined;
  }

  componentDidMount(): void {
    const canAnimate = this.props.leaflet
      && this.props.leaflet.map
      && this.props.leaflet.map.options.zoomAnimation
      && L.Browser.any3d;

    const zoomClass = `leaflet-zoom-${canAnimate ? 'animated' : 'hide'}`;

    const mapSize = this.props.leaflet
      && this.props.leaflet.map
      && this.props.leaflet.map.getSize()
      || 0;

    const transformProp = L.DomUtil.testProp(
      ['transformOrigin', 'WebkitTransformOrigin', 'msTransformOrigin']
    ) as string;

    this._el = L.DomUtil.create('canvas', zoomClass) as HTMLCanvasElement;
    this._el.style[transformProp] = '50% 50%';
    this._el.width = mapSize && mapSize.x || 0;
    this._el.height = mapSize.y;

    const el = this._el;

    const Heatmap = L.Layer.extend({
      onAdd: (leafletMap: Map) => leafletMap.getPanes().overlayPane.appendChild(el),
      addTo: (leafletMap: Map) => {
        leafletMap.addLayer(this as unknown as Layer);
        return this;
      },
      onRemove: (leafletMap: Map) => safeRemoveLayer(leafletMap, el)
    });

    this.leafletElement = new Heatmap();

    super.componentDidMount();

    this._heatmap = simpleheat(this._el);
    this.reset();

    if (this.props.fitBoundsOnLoad) {
      this.fitBounds();
    }
    this.attachEvents();
    this.updateHeatmapProps(this.getHeatmapProps(this.props));
  }

}

export default withLeaflet(HeatmapLayer);

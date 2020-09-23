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

interface HeatmapProps {
  // props controlling heatmap generation
  points?: Point[],
  max?: number;
  radius?: number,
  maxZoom?: number,
  minOpacity?: number,
  blur?: number,
  gradient?: Object,
}

interface HeatmapLayerProps extends HeatmapProps, MapLayerProps {
  fitBoundsOnLoad?: boolean,
  fitBoundsOnUpdate?: boolean,
  onStatsUpdate?: () => void,
  // props controlling extractors
  latitudeExtractor: (p: Point) => number,
  longitudeExtractor: (p: Point) => number,
  intensityExtractor: (p: Point) => number,
};

class HeatmapLayer extends MapLayer<HeatmapLayerProps> {
  points: Point[];
  max: number;
  radius: number;
  maxZoom: number;
  minOpacity: number;
  blur: number;
  gradient: Object;
  fitBoundsOnLoad: boolean;
  fitBoundsOnUpdate: boolean;

  latitudeExtractor: (p: Point) => number;
  longitudeExtractor: (p: Point) => number;
  intensityExtractor: (p: Point) => number;
  onStatsUpdate?: () => void;

  private _el!: HTMLCanvasElement;
  private _heatmap!: any;

  private readonly DEFAULT_POINTS = [];
  private readonly DEFAULT_MAX = 3;
  private readonly DEFAULT_RADIUS = 30;
  private readonly DEFAULT_MAX_ZOOM = 18;
  private readonly DEFAULT_MIN_OPACITY = 0.01;
  private readonly DEFAULT_BLUR = 15;
  private readonly DEFAULT_GRADIENT = {};

  constructor(props: HeatmapLayerProps) {
    super(props);
    this.points = props.points || this.DEFAULT_POINTS;
    this.max = props.max || this.DEFAULT_MAX;
    this.radius = props.radius || this.DEFAULT_RADIUS;
    this.maxZoom = props.maxZoom || this.DEFAULT_MAX_ZOOM;
    this.minOpacity = props.minOpacity || this.DEFAULT_MIN_OPACITY;
    this.blur = props.blur || this.DEFAULT_BLUR;
    this.gradient = props.gradient || this.DEFAULT_GRADIENT;
    this.fitBoundsOnLoad = props.fitBoundsOnLoad || false;
    this.fitBoundsOnUpdate = props.fitBoundsOnUpdate || false;
    this.latitudeExtractor = props.latitudeExtractor;
    this.longitudeExtractor = props.longitudeExtractor;
    this.intensityExtractor = props.intensityExtractor;
    this.onStatsUpdate = props.onStatsUpdate || undefined;
  }

  componentDidMount() {
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
    this._el.height = mapSize && mapSize.y || 0;

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

    // super.componentDidMount();

    this._heatmap = simpleheat(this._el);
    this.reset();

    if (this.props.fitBoundsOnLoad) {
      this.fitBounds();
    }

    this.attachEvents();
    this.updateHeatmapProps(this.getHeatmapProps(this.props));
  }

  componentWillReceiveProps(nextProps: HeatmapProps): void {
    const currentProps = this.props;
    const nextHeatmapProps = this.getHeatmapProps(nextProps);

    this.updateHeatmapGradient(nextHeatmapProps.gradient || {});

    const hasRadiusUpdated = nextHeatmapProps.radius !== currentProps.radius;
    const hasBlurUpdated = nextHeatmapProps.blur !== currentProps.blur;

    if (hasRadiusUpdated || hasBlurUpdated) {
      this.updateHeatmapRadius(nextHeatmapProps.radius, nextHeatmapProps.blur);
    }

    if (nextHeatmapProps.max !== currentProps.max) {
      this.updateHeatmapMax(nextHeatmapProps.max);
    }
  }

  componentDidUpdate(): void {
    if (this.props.leaflet && this.props.leaflet.map) {
      this.props.leaflet.map.invalidateSize();
    }

    if (this.props.fitBoundsOnUpdate) {
      this.fitBounds();
    }

    this.reset();
  }

  componentWillUnmount(): void {
    if (this.props && this.props.leaflet && this.props.leaflet.map) {
      safeRemoveLayer(this.props.leaflet.map, this._el);
    }
  }

  shouldComponentUpdate(): boolean {
    return true;
  }

  getHeatmapProps(props: HeatmapProps) {
    return {
      minOpacity: this.getMinOpacity(props),
      maxZoom: this.getMaxZoom(props),
      radius: this.getRadius(props),
      blur: this.getBlur(props),
      max: this.getMax(props),
      gradient: this.getGradient(props)
    };
  }

  getMax(props: HeatmapProps) {
    return props.max || 3.0;
  }

  getRadius(props: HeatmapProps) {
    return props.radius || 30;
  }

  getMaxZoom(props: HeatmapProps) {
    return props.maxZoom || 18;
  }

  getMinOpacity(props: HeatmapProps) {
    return props.minOpacity || 0.01;
  }

  getBlur(props: HeatmapProps) {
    return props.blur || 15;
  }

  getGradient(props: HeatmapProps) {
    return props.gradient || {};
  }

  /**
   * Update various heatmap properties like radius, gradient, and max
   */
  private updateHeatmapProps(props: HeatmapProps) {
    this.updateHeatmapRadius(props.radius || this.DEFAULT_RADIUS, props.blur);
    this.updateHeatmapGradient(props.gradient || this.DEFAULT_GRADIENT);
    this.updateHeatmapMax(props.max || this.DEFAULT_MAX);
  }

  /**
   * Update the heatmap's radius and blur (blur is optional)
   */
  private updateHeatmapRadius(radius: number, blur?: number): void {
    if (radius) {
      this._heatmap.radius(radius, blur);
    }
  }

  /**
   * Update the heatmap's gradient
   */
  private updateHeatmapGradient(gradient: Object): void {
    if (gradient) {
      this._heatmap.gradient(gradient);
    }
  }

  /**
   * Update the heatmap's maximum
   */
  private updateHeatmapMax(maximum: number): void {
    if (maximum) {
      this._heatmap.max(maximum);
    }
  }

  private fitBounds(): void {
    const points = this.points;
    const lngs = points.map(this.props.longitudeExtractor);
    const lats = points.map(this.props.latitudeExtractor);

    const ne = new LatLng(Math.max(...lats), Math.max(...lngs));
    const sw = new LatLng(Math.min(...lats), Math.min(...lngs));

    if (shouldIgnoreLocation(ne) || shouldIgnoreLocation(sw)) {
      return;
    }

    if (this.props.leaflet && this.props.leaflet.map) {
      this.props.leaflet.map.fitBounds(L.latLngBounds(L.latLng(sw), L.latLng(ne)));
    }
  }

  private attachEvents(): void {
    if (this.props.leaflet && this.props.leaflet.map) {
      const leafletMap: Map = this.props.leaflet.map;

      leafletMap.on('viewreset', () => this.reset());
      leafletMap.on('moveend', () => this.reset());

      if (leafletMap.options.zoomAnimation && L.Browser.any3d) {
        // leafletMap.on('zoomanim', this._animateZoom, this);
      }
    }
  }


  // private _animateZoom(e: ZoomAnimEvent): void {
  //   const scale = this.props.leaflet && this.props.leaflet.map && this.props.leaflet.map.getZoomScale(e.zoom);
  //   const offset = this.props.leaflet && this.props.leaflet.map && this.props.leaflet.map
  //     ._getCenterOffset(e.center)
  //     ._multiplyBy(-scale)
  //     .subtract(this.props.leaflet.map._getMapPanePos());

  //   if (L.DomUtil.setTransform) {
  //     L.DomUtil.setTransform(this._el, offset, scale);
  //   } else {
  //     this._el.style[L.DomUtil.TRANSFORM] =
  //       `${L.DomUtil.getTranslateString(offset)} scale(${scale})`;
  //   }
  // }

  reset(): void {
    const topLeft = this.props.leaflet
      && this.props.leaflet.map
      && this.props.leaflet.map.containerPointToLayerPoint([0, 0])
      || new Point(0, 0);

    L.DomUtil.setPosition(this._el, topLeft);

    const size = this.props.leaflet
      && this.props.leaflet.map
      && this.props.leaflet.map.getSize()
      || new Point(0, 0);

    if (this._heatmap._width !== size.x) {
      this._el.width = this._heatmap._width = size.x;
    }

    if (this._heatmap._height !== size.y) {
      this._el.height = this._heatmap._height = size.y;
    }

    // if (this._heatmap && !this._frame && !this.props.leaflet.map._animating) {
    //   this._frame = L.Util.requestAnimFrame(this.redraw, this);
    // }

    this.redraw();
  }

  redraw(): void {
    const r = this._heatmap._r;
    const size = this.props.leaflet
      && this.props.leaflet.map
      && this.props.leaflet.map.getSize()
      || new Point(0, 0);

    const maxIntensity = this.props.max === undefined
      ? 1
      : this.getMax(this.props);

    const maxZoom = this.props.maxZoom === undefined
      ? this.props.leaflet.map.getMaxZoom()
      : this.getMaxZoom(this.props);

    const v = 1 / Math.pow(
      2,
      Math.max(0, Math.min(maxZoom - this.props.leaflet.map.getZoom(), 12)) / 2
    );

    const cellSize = r / 2;
    const panePos = this.props.leaflet.map._getMapPanePos();
    const offsetX = panePos.x % cellSize;
    const offsetY = panePos.y % cellSize;
    const getLat = this.props.latitudeExtractor;
    const getLng = this.props.longitudeExtractor;
    const getIntensity = this.props.intensityExtractor;

    const inBounds = (p, bounds) => bounds.contains(p);

    const filterUndefined = (row) => filter(row, c => c !== undefined);

    const roundResults = (results) => reduce(results, (result, row) =>
      map(filterUndefined(row), (cell) => [
        Math.round(cell[0]),
        Math.round(cell[1]),
        Math.min(cell[2], maxIntensity),
        cell[3]
      ]).concat(result),
      []
    );

    const accumulateInGrid = (points, leafletMap, bounds) => reduce(points, (grid, point) => {
      const latLng = [getLat(point), getLng(point)];
      if (isInvalidLatLngArray(latLng)) { //skip invalid points
        return grid;
      }

      const p = leafletMap.latLngToContainerPoint(latLng);

      if (!inBounds(p, bounds)) {
        return grid;
      }

      const x = Math.floor((p.x - offsetX) / cellSize) + 2;
      const y = Math.floor((p.y - offsetY) / cellSize) + 2;

      grid[y] = grid[y] || [];
      const cell = grid[y][x];

      const alt = getIntensity(point);
      const k = alt * v;

      if (!cell) {
        grid[y][x] = [p.x, p.y, k, 1];
      } else {
        cell[0] = (cell[0] * cell[2] + p.x * k) / (cell[2] + k); // x
        cell[1] = (cell[1] * cell[2] + p.y * k) / (cell[2] + k); // y
        cell[2] += k; // accumulated intensity value
        cell[3] += 1;
      }

      return grid;
    }, []);

    const getBounds = () => new L.Bounds(L.point([-r, -r]), size.add([r, r]));

    const getDataForHeatmap = (points, leafletMap) => roundResults(
      accumulateInGrid(
        points,
        leafletMap,
        getBounds(leafletMap)
      )
    );

    const data = getDataForHeatmap(this.props.points, this.props.leaflet.map);

    this._heatmap.clear();
    this._heatmap.data(data).draw(this.getMinOpacity(this.props));

    this._frame = null;

    if (this.props.onStatsUpdate && this.props.points && this.props.points.length > 0) {
      this.props.onStatsUpdate(
        reduce(data, (stats, point) => {
          stats.max = point[3] > stats.max ? point[3] : stats.max;
          stats.min = point[3] < stats.min ? point[3] : stats.min;
          return stats;
        }, { min: Infinity, max: -Infinity })
      );
    }
  }


  render() {
    return null;
  }
}

export default withLeaflet(HeatmapLayer);

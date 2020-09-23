// Based on leaflet.heat

import React from 'react';
import { LatLng, heatLayer, TileLayer } from 'leaflet';
import 'leaflet.heat';
import { MapLayer, MapLayerProps, withLeaflet } from 'react-leaflet';

interface Gradient {
  [key: number]: string;
}

interface HeatmapOptions {
  max?: number;
  radius?: number,
  maxZoom?: number,
  minOpacity?: number,
  blur?: number,
  gradient?: Gradient,
}

interface HeatmapProps extends HeatmapOptions {
  points?: LatLng[],
}

interface HeatmapLayerProps extends HeatmapProps, MapLayerProps { }

interface HeatLayer extends TileLayer {
  setOptions(options: HeatmapOptions): HeatLayer;
  addLatLng(latlng: LatLng): HeatLayer;
  setLatLngs(latlngs: LatLng[]): HeatLayer;
}

class HeatmapLayer extends MapLayer<HeatmapLayerProps> {
  private _heatmap!: HeatLayer;

  constructor(props: HeatmapLayerProps) {
    super(props);
  }

  componentDidMount() {
    this._heatmap = heatLayer(
      this.getPoints(this.props),
      this.getOptions(this.props),
    );
  }

  componentWillReceiveProps(props: HeatmapProps): void {
    this.setLatLngs(this.getPoints(props));
    this.setOptions(this.getOptions(props));
  }

  getPoints(props: HeatmapProps) {
    return props.points || [];
  }

  getMax(props: HeatmapProps) {
    return props.max || 1.0;
  }

  getRadius(props: HeatmapProps) {
    return props.radius || 25;
  }

  getMaxZoom(props: HeatmapProps) {
    return props.maxZoom || 18;
  }

  getMinOpacity(props: HeatmapProps) {
    return props.minOpacity || 0.05;
  }

  getBlur(props: HeatmapProps) {
    return props.blur || 15;
  }

  getGradient(props: HeatmapProps) {
    return props.gradient || {};
  }

  getOptions(props: HeatmapProps): HeatmapProps {
    return {
      minOpacity: this.getMinOpacity(props),
      maxZoom: this.getMaxZoom(props),
      radius: this.getRadius(props),
      blur: this.getBlur(props),
      max: this.getMax(props),
      gradient: this.getGradient(props)
    };
  }

  setOptions(options: HeatmapOptions) {
    this._heatmap = this._heatmap.setOptions(options);
  }

  setLatLngs(latlngs: LatLng[]) {
    this._heatmap = this._heatmap.setLatLngs(latlngs);
  }

  addLatLng(latlng: LatLng) {
    this._heatmap = this._heatmap.addLatLng(latlng);
  }

  render() {
    return null;
  }
}

export default withLeaflet(HeatmapLayer);

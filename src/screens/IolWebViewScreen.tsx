import React, { useRef, useState } from 'react';
import {
  View, Text, ActivityIndicator, TouchableOpacity, StyleSheet,
} from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';

type Route = RouteProp<RootStackParamList, 'IolWebView'>;

const USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) ' +
  'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';

export default function IolWebViewScreen() {
  const { params } = useRoute<Route>();
  const webRef = useRef<WebView>(null);
  const [loading,  setLoading]  = useState(true);
  const [canBack,  setCanBack]  = useState(false);
  const [canFwd,   setCanFwd]   = useState(false);
  const [errored,  setErrored]  = useState(false);

  function handleNav(e: WebViewNavigation) {
    setCanBack(e.canGoBack);
    setCanFwd(e.canGoForward);
  }

  function retry() {
    setErrored(false);
    setLoading(true);
    webRef.current?.reload();
  }

  return (
    <View style={s.container}>
      {/* Toolbar */}
      <View style={s.toolbar}>
        <TouchableOpacity style={[s.toolBtn, !canBack && s.dim]} onPress={() => webRef.current?.goBack()} disabled={!canBack}>
          <Text style={s.toolBtnText}>‹</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.toolBtn, !canFwd && s.dim]} onPress={() => webRef.current?.goForward()} disabled={!canFwd}>
          <Text style={s.toolBtnText}>›</Text>
        </TouchableOpacity>
        <View style={s.toolbarCenter}>
          <Text style={s.toolbarTitle} numberOfLines={1}>{params.title}</Text>
          {params.subtitle ? <Text style={s.toolbarSub} numberOfLines={1}>{params.subtitle}</Text> : null}
        </View>
        <TouchableOpacity style={s.toolBtn} onPress={() => webRef.current?.reload()}>
          <Text style={s.toolBtnText}>↺</Text>
        </TouchableOpacity>
      </View>

      {/* WebView */}
      {!errored ? (
        <WebView
          ref={webRef}
          source={{ uri: params.url }}
          userAgent={USER_AGENT}
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          startInLoadingState={false}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onNavigationStateChange={handleNav}
          onError={() => { setLoading(false); setErrored(true); }}
          onHttpError={e => { if (e.nativeEvent.statusCode >= 400) { setLoading(false); setErrored(true); } }}
          style={s.webView}
        />
      ) : (
        <View style={s.errorBox}>
          <Text style={s.errorIcon}>⚠</Text>
          <Text style={s.errorTitle}>Could not load calculator</Text>
          <Text style={s.errorBody}>Check your internet connection and try again.</Text>
          <TouchableOpacity style={s.retryBtn} onPress={retry}>
            <Text style={s.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Loading overlay */}
      {loading && !errored && (
        <View style={s.loadingOverlay} pointerEvents="none">
          <View style={s.loadingCard}>
            <ActivityIndicator size="large" color="#C8A84B" />
            <Text style={s.loadingText}>Loading {params.title}…</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  toolbar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8F6EF', borderBottomWidth: 1, borderBottomColor: '#DDD5BB',
    paddingHorizontal: 8, paddingVertical: 6, gap: 4,
  },
  toolbarCenter: { flex: 1, alignItems: 'center' },
  toolbarTitle: { color: '#1A1200', fontSize: 13, fontWeight: '700' },
  toolbarSub: { color: '#888060', fontSize: 10, marginTop: 1 },
  toolBtn: {
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
    borderRadius: 8, backgroundColor: '#EDEADE',
  },
  dim: { opacity: 0.35 },
  toolBtnText: { color: '#1A1200', fontSize: 20, fontWeight: '600', lineHeight: 24 },
  webView: { flex: 1 },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center', justifyContent: 'center',
  },
  loadingCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 28, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  loadingText: { color: '#1A1200', fontSize: 15, fontWeight: '600', marginTop: 14 },
  errorBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorIcon: { fontSize: 40, marginBottom: 12 },
  errorTitle: { color: '#1A1200', fontSize: 17, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  errorBody: { color: '#666', fontSize: 13, lineHeight: 19, textAlign: 'center', marginBottom: 24 },
  retryBtn: {
    backgroundColor: '#C8A84B', borderRadius: 12,
    paddingVertical: 13, paddingHorizontal: 32,
  },
  retryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

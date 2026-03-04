package core

// integration.go - 将自定义模块集成到 FlClash 核心的桥接层
// 此文件提供 FFI / cgo 导出函数，供 Flutter 端通过 Platform Channel 调用

/*
#include <stdlib.h>
*/
import "C"
import (
	"encoding/json"
	"unsafe"

	"github.com/gkd-cloud/flclash-custom/core/dns"
	"github.com/gkd-cloud/flclash-custom/core/masking"
	"github.com/gkd-cloud/flclash-custom/core/subscription"
)

var (
	globalDoHResolver *dns.DoHResolver
	globalDomainMasker *masking.DomainMasker
)

// InitCustomModules 初始化自定义模块
//
//export InitCustomModules
func InitCustomModules(dohConfigJSON *C.char, maskConfigJSON *C.char) *C.char {
	// 初始化 DoH
	var dohConfig dns.DoHConfig
	if dohConfigJSON != nil {
		if err := json.Unmarshal([]byte(C.GoString(dohConfigJSON)), &dohConfig); err != nil {
			return C.CString(`{"error":"` + err.Error() + `"}`)
		}
	} else {
		dohConfig = *dns.DefaultDoHConfig()
	}
	globalDoHResolver = dns.NewDoHResolver(&dohConfig)

	// 初始化域名伪装
	var maskConfig masking.MaskConfig
	if maskConfigJSON != nil {
		if err := json.Unmarshal([]byte(C.GoString(maskConfigJSON)), &maskConfig); err != nil {
			return C.CString(`{"error":"` + err.Error() + `"}`)
		}
	}
	var err error
	globalDomainMasker, err = masking.NewDomainMasker(&maskConfig)
	if err != nil {
		return C.CString(`{"error":"` + err.Error() + `"}`)
	}

	return C.CString(`{"status":"ok"}`)
}

// ParseSubscription 解析订阅内容
// panelType: "sspanel" 或 "v2board"
//
//export ParseSubscription
func ParseSubscription(rawContent *C.char, panelType *C.char) *C.char {
	content := C.GoString(rawContent)
	pType := C.GoString(panelType)

	var converter subscription.Converter
	switch pType {
	case "v2board":
		converter = subscription.NewV2BoardConverter()
	default:
		converter = subscription.NewSSPanelConverter()
	}

	result, err := converter.Parse(content)
	if err != nil {
		return C.CString(`{"error":"` + err.Error() + `"}`)
	}

	// 应用域名伪装
	if globalDomainMasker != nil {
		nodeMasker := masking.NewProxyNodeMasker(globalDomainMasker)
		for i, node := range result.Nodes {
			nodeMap := proxyNodeToMap(node)
			maskedMap := nodeMasker.MaskNodeFields(nodeMap)
			result.Nodes[i] = mapToProxyNode(maskedMap)
		}
	}

	jsonBytes, err := json.Marshal(result)
	if err != nil {
		return C.CString(`{"error":"` + err.Error() + `"}`)
	}

	return C.CString(string(jsonBytes))
}

// MaskDomain 对单个域名进行伪装
//
//export MaskDomain
func MaskDomain(domain *C.char) *C.char {
	if globalDomainMasker == nil {
		return domain
	}
	result := globalDomainMasker.MaskDomain(C.GoString(domain))
	return C.CString(result)
}

// UpdateDoHConfig 更新 DoH 配置
//
//export UpdateDoHConfig
func UpdateDoHConfig(configJSON *C.char) *C.char {
	var config dns.DoHConfig
	if err := json.Unmarshal([]byte(C.GoString(configJSON)), &config); err != nil {
		return C.CString(`{"error":"` + err.Error() + `"}`)
	}
	globalDoHResolver = dns.NewDoHResolver(&config)
	return C.CString(`{"status":"ok"}`)
}

// UpdateMaskConfig 更新域名伪装配置
//
//export UpdateMaskConfig
func UpdateMaskConfig(configJSON *C.char) *C.char {
	var config masking.MaskConfig
	if err := json.Unmarshal([]byte(C.GoString(configJSON)), &config); err != nil {
		return C.CString(`{"error":"` + err.Error() + `"}`)
	}
	if globalDomainMasker != nil {
		if err := globalDomainMasker.UpdateConfig(&config); err != nil {
			return C.CString(`{"error":"` + err.Error() + `"}`)
		}
	}
	return C.CString(`{"status":"ok"}`)
}

// GenerateClashDNSConfig 生成 Clash DNS 配置
//
//export GenerateClashDNSConfig
func GenerateClashDNSConfig() *C.char {
	if globalDoHResolver == nil {
		return C.CString(`{}`)
	}
	config := globalDoHResolver.GenerateClashDNSConfig()
	jsonBytes, _ := json.Marshal(config)
	return C.CString(string(jsonBytes))
}

// SpeedTestDoH 对 DoH 服务器进行测速
//
//export SpeedTestDoH
func SpeedTestDoH() *C.char {
	if globalDoHResolver == nil {
		return C.CString(`{}`)
	}
	// 使用 background context
	import "context"
	results := globalDoHResolver.SpeedTest(context.Background())

	// 转换为 ms 单位的 map
	msResults := make(map[string]int64)
	for url, dur := range results {
		msResults[url] = dur.Milliseconds()
	}

	jsonBytes, _ := json.Marshal(msResults)
	return C.CString(string(jsonBytes))
}

// FreeCString 释放 C 字符串内存
//
//export FreeCString
func FreeCString(str *C.char) {
	C.free(unsafe.Pointer(str))
}

// 辅助转换函数

func proxyNodeToMap(node subscription.ProxyNode) map[string]interface{} {
	data, _ := json.Marshal(node)
	var m map[string]interface{}
	json.Unmarshal(data, &m)
	return m
}

func mapToProxyNode(m map[string]interface{}) subscription.ProxyNode {
	data, _ := json.Marshal(m)
	var node subscription.ProxyNode
	json.Unmarshal(data, &node)
	return node
}

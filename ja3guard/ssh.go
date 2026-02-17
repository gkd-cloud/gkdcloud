package main

import (
	"bytes"
	"fmt"
	"net"
	"time"

	"golang.org/x/crypto/ssh"
)

// SSHClient 封装 SSH 连接操作
type SSHClient struct {
	node *NodeInfo
}

func NewSSHClient(node *NodeInfo) *SSHClient {
	return &SSHClient{node: node}
}

// buildConfig 构建 SSH 客户端配置
func (sc *SSHClient) buildConfig() (*ssh.ClientConfig, error) {
	config := &ssh.ClientConfig{
		User:            sc.node.SSHUser,
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         10 * time.Second,
	}

	switch sc.node.AuthType {
	case "key":
		if sc.node.SSHKey == "" {
			return nil, fmt.Errorf("SSH 私钥为空")
		}
		signer, err := ssh.ParsePrivateKey([]byte(sc.node.SSHKey))
		if err != nil {
			return nil, fmt.Errorf("解析 SSH 私钥失败: %w", err)
		}
		config.Auth = []ssh.AuthMethod{ssh.PublicKeys(signer)}
	case "password":
		if sc.node.SSHPass == "" {
			return nil, fmt.Errorf("SSH 密码为空")
		}
		config.Auth = []ssh.AuthMethod{ssh.Password(sc.node.SSHPass)}
	default:
		return nil, fmt.Errorf("不支持的认证方式: %s", sc.node.AuthType)
	}

	return config, nil
}

// connect 建立 SSH 连接
func (sc *SSHClient) connect() (*ssh.Client, error) {
	config, err := sc.buildConfig()
	if err != nil {
		return nil, err
	}

	addr := fmt.Sprintf("%s:%d", sc.node.Host, sc.node.SSHPort)
	client, err := ssh.Dial("tcp", addr, config)
	if err != nil {
		return nil, fmt.Errorf("SSH 连接失败 %s: %w", addr, err)
	}
	return client, nil
}

// TestConnection 测试 SSH 连接
func (sc *SSHClient) TestConnection() error {
	client, err := sc.connect()
	if err != nil {
		return err
	}
	defer client.Close()

	session, err := client.NewSession()
	if err != nil {
		return fmt.Errorf("创建会话失败: %w", err)
	}
	defer session.Close()

	output, err := session.CombinedOutput("echo 'JA3 Guard SSH OK' && uname -a")
	if err != nil {
		return fmt.Errorf("执行命令失败: %w, output: %s", err, string(output))
	}
	return nil
}

// Exec 在远程服务器执行命令
func (sc *SSHClient) Exec(cmd string) (string, error) {
	client, err := sc.connect()
	if err != nil {
		return "", err
	}
	defer client.Close()

	session, err := client.NewSession()
	if err != nil {
		return "", fmt.Errorf("创建会话失败: %w", err)
	}
	defer session.Close()

	var stdout, stderr bytes.Buffer
	session.Stdout = &stdout
	session.Stderr = &stderr

	if err := session.Run(cmd); err != nil {
		return "", fmt.Errorf("命令执行失败: %w\nstdout: %s\nstderr: %s", err, stdout.String(), stderr.String())
	}

	return stdout.String() + stderr.String(), nil
}

// GetSystemInfo 获取远程系统信息
func (sc *SSHClient) GetSystemInfo() (map[string]string, error) {
	info := make(map[string]string)

	client, err := sc.connect()
	if err != nil {
		return nil, err
	}
	defer client.Close()

	// 一次性获取多项信息
	cmd := `echo "OS=$(cat /etc/os-release 2>/dev/null | grep ^PRETTY_NAME | cut -d= -f2 | tr -d '"')"
echo "KERNEL=$(uname -r)"
echo "ARCH=$(uname -m)"
echo "CPU=$(nproc)"
echo "MEM_TOTAL=$(free -m | awk '/Mem:/{print $2}')MB"
echo "MEM_USED=$(free -m | awk '/Mem:/{print $3}')MB"
echo "DISK=$(df -h / | awk 'NR==2{print $3"/"$2}')"
echo "NGINX=$(nginx -v 2>&1 | grep -o 'nginx/[0-9.]*' || echo 'not installed')"
echo "JA3GUARD=$(ja3guard -version 2>&1 || systemctl is-active ja3guard 2>/dev/null || echo 'not installed')"`

	session, err := client.NewSession()
	if err != nil {
		return nil, err
	}
	defer session.Close()

	var stdout bytes.Buffer
	session.Stdout = &stdout
	session.Run(cmd)

	for _, line := range bytes.Split(stdout.Bytes(), []byte("\n")) {
		parts := bytes.SplitN(line, []byte("="), 2)
		if len(parts) == 2 {
			info[string(parts[0])] = string(parts[1])
		}
	}

	return info, nil
}

// UploadAndExec 上传脚本内容并执行
func (sc *SSHClient) UploadAndExec(scriptContent, remotePath string) (string, error) {
	client, err := sc.connect()
	if err != nil {
		return "", err
	}
	defer client.Close()

	// 写入脚本
	session, err := client.NewSession()
	if err != nil {
		return "", err
	}
	session.Stdin = bytes.NewReader([]byte(scriptContent))
	if err := session.Run(fmt.Sprintf("cat > %s && chmod +x %s", remotePath, remotePath)); err != nil {
		session.Close()
		return "", fmt.Errorf("上传脚本失败: %w", err)
	}
	session.Close()

	// 执行脚本
	session2, err := client.NewSession()
	if err != nil {
		return "", err
	}
	defer session2.Close()

	var stdout, stderr bytes.Buffer
	session2.Stdout = &stdout
	session2.Stderr = &stderr

	if err := session2.Run("bash " + remotePath); err != nil {
		return stdout.String() + "\n" + stderr.String(), fmt.Errorf("执行脚本失败: %w", err)
	}

	return stdout.String() + stderr.String(), nil
}

// CheckPort 检查远程端口是否开放
func (sc *SSHClient) CheckPort(port int) bool {
	addr := fmt.Sprintf("%s:%d", sc.node.Host, port)
	conn, err := net.DialTimeout("tcp", addr, 5*time.Second)
	if err != nil {
		return false
	}
	conn.Close()
	return true
}

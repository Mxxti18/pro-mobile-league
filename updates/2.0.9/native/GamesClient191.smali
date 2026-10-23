.class public Lcom/promobileleague/personal/GamesClient191;
.super Lcom/promobileleague/personal/MainActivity$1;
.field private assetContext209:Landroid/content/Context;

.method public constructor <init>(Lcom/promobileleague/personal/MainActivity;)V
 .locals 0
 invoke-direct {p0,p1},Lcom/promobileleague/personal/MainActivity$1;-><init>(Lcom/promobileleague/personal/MainActivity;)V
 iput-object p1,p0,Lcom/promobileleague/personal/GamesClient191;->assetContext209:Landroid/content/Context;
 return-void
.end method

.method public shouldInterceptRequest(Landroid/webkit/WebView;Landroid/webkit/WebResourceRequest;)Landroid/webkit/WebResourceResponse;
 .locals 6
 invoke-interface {p2},Landroid/webkit/WebResourceRequest;->getUrl()Landroid/net/Uri;
 move-result-object v0
 invoke-virtual {v0},Landroid/net/Uri;->getScheme()Ljava/lang/String;
 move-result-object v1
 const-string v2,"https"
 invoke-virtual {v2,v1},Ljava/lang/String;->equals(Ljava/lang/Object;)Z
 move-result v1
 if-eqz v1,:original
 invoke-virtual {v0},Landroid/net/Uri;->getHost()Ljava/lang/String;
 move-result-object v1
 const-string v2,"appassets.androidplatform.net"
 invoke-virtual {v2,v1},Ljava/lang/String;->equals(Ljava/lang/Object;)Z
 move-result v2
 if-eqz v2,:games
 invoke-virtual {v0},Landroid/net/Uri;->getPort()I
 move-result v1
 const/4 v2,-0x1
 if-eq v1,v2,:asset_method
 const/16 v2,0x1bb
 if-ne v1,v2,:original
 :asset_method
 invoke-interface {p2},Landroid/webkit/WebResourceRequest;->getMethod()Ljava/lang/String;
 move-result-object v1
 const-string v2,"GET"
 invoke-virtual {v2,v1},Ljava/lang/String;->equals(Ljava/lang/Object;)Z
 move-result v1
 if-eqz v1,:original
 invoke-virtual {v0},Landroid/net/Uri;->getPath()Ljava/lang/String;
 move-result-object v1
 if-eqz v1,:original
 const-string v2,"/(gateway208|drafts208|update-v208)\\.js"
 invoke-virtual {v1,v2},Ljava/lang/String;->matches(Ljava/lang/String;)Z
 move-result v2
 if-eqz v2,:original
 const/4 v2,0x1
 invoke-virtual {v1,v2},Ljava/lang/String;->substring(I)Ljava/lang/String;
 move-result-object v1
 :asset_try
 iget-object v2,p0,Lcom/promobileleague/personal/GamesClient191;->assetContext209:Landroid/content/Context;
 invoke-virtual {v2},Landroid/content/Context;->getAssets()Landroid/content/res/AssetManager;
 move-result-object v2
 invoke-virtual {v2,v1},Landroid/content/res/AssetManager;->open(Ljava/lang/String;)Ljava/io/InputStream;
 move-result-object v3
 new-instance v0,Landroid/webkit/WebResourceResponse;
 const-string v1,"application/javascript"
 const-string v2,"UTF-8"
 invoke-direct {v0,v1,v2,v3},Landroid/webkit/WebResourceResponse;-><init>(Ljava/lang/String;Ljava/lang/String;Ljava/io/InputStream;)V
 :asset_end
 return-object v0
 .catch Ljava/io/IOException; {:asset_try .. :asset_end} :asset_error
 :asset_error
 move-exception v0
 goto :original
 :games
 invoke-virtual {v0},Landroid/net/Uri;->getHost()Ljava/lang/String;
 move-result-object v1
 const-string v2,"pml-juegos.matifc-cai.workers.dev"
 invoke-virtual {v2,v1},Ljava/lang/String;->equals(Ljava/lang/Object;)Z
 move-result v1
 if-eqz v1,:original
 invoke-virtual {v0},Landroid/net/Uri;->getPort()I
 move-result v0
 const/4 v1,-0x1
 if-eq v0,v1,:allow
 const/16 v1,0x1bb
 if-ne v0,v1,:original
 :allow
 const/4 v0,0x0
 return-object v0
 :original
 invoke-super {p0,p1,p2},Lcom/promobileleague/personal/MainActivity$1;->shouldInterceptRequest(Landroid/webkit/WebView;Landroid/webkit/WebResourceRequest;)Landroid/webkit/WebResourceResponse;
 move-result-object v0
 return-object v0
.end method
